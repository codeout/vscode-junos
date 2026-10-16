import type { Position, Range, TextDocumentPositionParams } from "vscode-languageserver";
import { Location } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { prefixPattern } from "./parser";
import { definitionsOfReferenceAt } from "./references";
import type { Session } from "./session";

export class DefinitionStore {
  private readonly store: {
    [uri: string]: {
      [logicalSystem: string]: {
        [symbolType: string]: {
          [symbol: string]: Range[];
        };
      };
    };
  };

  constructor() {
    this.store = {};
  }

  set(uri: string, logicalSystem: string, symbolType: string, symbol: string, definition: Range) {
    // initialize
    this.store[uri] ||= {};
    this.store[uri][logicalSystem] ||= {};
    this.store[uri][logicalSystem][symbolType] ||= {};
    this.store[uri][logicalSystem][symbolType][symbol] ||= [];

    const definitions = this.store[uri][logicalSystem][symbolType][symbol];
    // A curly-brace statement is seen once per nested statement below it
    const isDuplicate = definitions.some(
      (d) =>
        d.start.line === definition.start.line &&
        d.start.character === definition.start.character &&
        d.end.line === definition.end.line &&
        d.end.character === definition.end.character,
    );
    if (!isDuplicate) {
      definitions.push(definition);
    }
  }

  /**
   * Return definition, [] when a given symbol is not defined, undefined when the symbol is undefined.
   * NOTE: It's important to return undefined in the last case to chain findings.
   *
   * @param uri
   * @param symbolType
   * @param symbol
   */
  get(uri: string, symbolType: string, symbol: PointedSymbol) {
    if (!symbol.symbol) {
      return;
    }

    return this.store[uri]?.[symbol.logicalSystem]?.[symbolType]?.[symbol.symbol] || [];
  }

  /**
   * Return all symbol definitions for the given symbolType.
   *
   * @param uri
   * @param logicalSystem
   * @param symbolType
   */
  getDefinitions(uri: string, logicalSystem: string, symbolType: string) {
    return this.store[uri]?.[logicalSystem]?.[symbolType] || {};
  }

  /**
   * The definition whose range contains `position`; the innermost one when ranges nest
   * (an interface name inside the "xe-0/0/0 unit 0" range of "xe-0/0/0.0").
   */
  at(uri: string, position: Position) {
    const inside = (r: Range) =>
      (r.start.line < position.line || (r.start.line === position.line && r.start.character <= position.character)) &&
      (r.end.line > position.line || (r.end.line === position.line && r.end.character >= position.character));
    const size = (r: Range) => (r.end.line - r.start.line) * 1e6 + r.end.character - r.start.character;

    let best: { logicalSystem: string; type: string; symbol: string; range: Range } | undefined;
    const logicalSystems = Object.entries(this.store[uri] || {});
    for (const [logicalSystem, types] of logicalSystems) {
      for (const [type, symbols] of Object.entries(types)) {
        for (const [symbol, ranges] of Object.entries(symbols)) {
          for (const range of ranges) {
            if (inside(range) && (!best || size(range) < size(best.range))) {
              best = { logicalSystem, type, symbol, range };
            }
          }
        }
      }
    }
    return best;
  }

  /**
   * Every definition range of the document
   */
  ranges(uri: string): Range[] {
    const logicalSystems = Object.values(this.store[uri] || {});
    return logicalSystems.flatMap((types) => Object.values(types).flatMap((symbols) => Object.values(symbols).flat()));
  }

  clear(uri: string) {
    if (!this.store[uri]) {
      return;
    }

    this.store[uri] = {};
  }
}

/**
 * Statements whose argument is a policy-statement name.
 * Shared by go to definition, validation and completion.
 * "vrf-target import target:..." takes a community value, not a policy. "import-policy": rib-groups and
 * resolution ribs.
 */
export const policyStatementReference =
  "(?<!vrf-target\\s+)(?:(?:(?:vrf|instance|network-summary|inter-area-prefix|bootstrap)-)?(?:import|export)" +
  "|(?:keep|inet|inet6|iso|inetcolor|inet6color|vpn-global)-import|import-policy)";

/**
 * Statements whose argument is a policy-options prefix-list name: "from prefix-list" (policies and
 * firewall filters), "from source-prefix-list", "from ipv6-destination-prefix-list", "from prefix-list-filter".
 */
export const prefixListReference = "from\\s+(?:prefix-list-filter|(?:ipv6-)?(?:source-|destination-)?prefix-list)";

/**
 * Statements whose argument is a policy-options community name.
 * "route-attributes community" in EVPN ip-prefix-routes is not a reference.
 */
export const communityReference =
  "(?:from\\s+community|then\\s+community\\s+(?:add|delete|set)|aggregate-label\\s+community" +
  "|(?<=protocols\\s+)(?:l2circuit|l2vpn|vpls)(?:\\s+.*)?\\s+(?<!route-attributes\\s+)community)";

export type PointedSymbol = {
  logicalSystem: string;
  symbol?: string;
};

export function definition(session: Session) {
  return (textDocumentPosition: TextDocumentPositionParams) => {
    const doc = session.documents.get(textDocumentPosition.textDocument.uri);
    if (!doc) {
      return [];
    }

    const offset = doc.offsetAt(textDocumentPosition.position);

    const definition =
      definitionsOfReferenceAt(session, doc, offset) ||
      // On a definition itself: VS Code then shows its references (editor.gotoLocation.alternativeDefinitionCommand)
      [session.definitions.at(doc.uri, doc.positionAt(offset))?.range].filter((r) => r !== undefined);

    return definition.map((d) => Location.create(textDocumentPosition.textDocument.uri, d));
  };
}

export function updateDefinitions(session: Session, textDocument: TextDocument) {
  session.definitions.clear(textDocument.uri);

  updateInterfaceDefinitions(session, textDocument);
  updatePrefixListDefinitions(session, textDocument);
  updatePolicyStatementDefinitions(session, textDocument);
  updateCommunityDefinitions(session, textDocument);
  updateAsPathDefinitions(session, textDocument);
  updateAsPathGroupDefinitions(session, textDocument);
  updateFirewallFilterDefinitions(session, textDocument);
  updateServiceNatPoolDefinitions(session, textDocument);
  updateSecurityNatPoolDefinitions(session, textDocument);
  updateAddressDefinitions(session, textDocument);
  updateApplicationDefinitions(session, textDocument);
  updateRoutingInstanceDefinitions(session, textDocument);
  updateGroupDefinitions(session, textDocument);
}

// Configuration groups are global; "apply-groups" in a logical system refers to them too
function updateGroupDefinitions(session: Session, textDocument: TextDocument) {
  insertDefinitions(session, textDocument, "group", "groups\\s+)(\\S+)", (m) => m[3]);
}

function updateRoutingInstanceDefinitions(session: Session, textDocument: TextDocument) {
  insertDefinitions(session, textDocument, "routing-instance", "routing-instances\\s+)(\\S+)", (m) => m[3]);
}

function insertDefinitions(
  session: Session,
  textDocument: TextDocument,
  symbolType: string | ((arg: RegExpExecArray) => string),
  pattern: string,
  modifyFunction: (arg: RegExpExecArray) => string,
) {
  const { view } = session.analyze(textDocument);
  const text = view.text;

  // FIXME: We should have implemented with named captures, but avoid them due to performance consideration
  // A match must not run into the next line: "set routing-instances" (from "routing-instances {") would
  // otherwise take the "set" of the following line as an instance name
  const source = `(${prefixPattern.source}(?:\\s+logical-systems\\s+(\\S+))?\\s+${pattern}`.replaceAll(
    "\\s",
    "[^\\S\\n]",
  );
  const fullPattern = new RegExp(source, "gm");
  let m: RegExpExecArray | null;

  while ((m = fullPattern.exec(text))) {
    const type = typeof symbolType === "function" ? symbolType(m) : symbolType;
    const symbol = modifyFunction(m);
    session.definitions.set(textDocument.uri, m[2] || "global", type, symbol, {
      start: textDocument.positionAt(view.toSourceOffset(m.index + m[1].length)),
      end: textDocument.positionAt(view.toSourceOffset(m.index + m[0].length)),
    });
  }
}

function updateInterfaceDefinitions(session: Session, textDocument: TextDocument) {
  const type = "interface";
  insertDefinitions(session, textDocument, type, "interfaces\\s+)((?!interface-range)\\S+)", (m) => m[3]);
  insertDefinitions(session, textDocument, type, "interfaces interface-range\\s+)(\\S+)", (m) => m[3]);
  insertDefinitions(
    session,
    textDocument,
    type,
    "interfaces\\s+)(\\S+)\\s+unit\\s+([0-9]+)",
    (m) => `${m[3]}.${m[4]}`, // "xe-0/0/0 unit 0" is referred as "xe-0/0/0.0"
  );
}

function updatePrefixListDefinitions(session: Session, textDocument: TextDocument) {
  const type = "prefix-list";
  insertDefinitions(session, textDocument, type, "policy-options\\s+prefix-list\\s+)(\\S+)", (m) => m[3]);
}

function updatePolicyStatementDefinitions(session: Session, textDocument: TextDocument) {
  const type = "policy-statement";
  insertDefinitions(session, textDocument, type, "policy-options\\s+policy-statement\\s+)(\\S+)", (m) => m[3]);
}

function updateCommunityDefinitions(session: Session, textDocument: TextDocument) {
  const type = "community";
  insertDefinitions(session, textDocument, type, "policy-options\\s+community\\s+)(\\S+)", (m) => m[3]);
}

function updateAsPathDefinitions(session: Session, textDocument: TextDocument) {
  const type = "as-path";
  insertDefinitions(session, textDocument, type, "policy-options\\s+as-path\\s+)(\\S+)", (m) => m[3]);
}

function updateAsPathGroupDefinitions(session: Session, textDocument: TextDocument) {
  const type = "as-path-group";
  insertDefinitions(session, textDocument, type, "policy-options\\s+as-path-group\\s+)(\\S+)", (m) => m[3]);
}

function updateFirewallFilterDefinitions(session: Session, textDocument: TextDocument) {
  const type = "firewall-filter";
  insertDefinitions(session, textDocument, type, "firewall(?:\\s+family\\s+\\S+)?\\s+filter\\s+)(\\S+)", (m) => m[3]);
}

function updateServiceNatPoolDefinitions(session: Session, textDocument: TextDocument) {
  const type = "service-nat-pool";
  insertDefinitions(session, textDocument, type, "services\\s+nat\\s+pool\\s+)(\\S+)", (m) => m[3]);
}

function updateSecurityNatPoolDefinitions(session: Session, textDocument: TextDocument) {
  insertDefinitions(
    session,
    textDocument,
    (m) => `security-nat-pool:${m[3]}`,
    "security\\s+nat\\s+(source|destination)\\s+pool\\s+)(\\S+)",
    (m) => m[4],
  );
}

function updateAddressDefinitions(session: Session, textDocument: TextDocument) {
  session.zoneAddressBooks.clear(textDocument.uri);
  updateGlobalAddressDefinitions(session, textDocument);
  updateZoneSpecificAddressDefinitions(session, textDocument);
}

function updateGlobalAddressDefinitions(session: Session, textDocument: TextDocument) {
  const text = session.analyze(textDocument).view.text;

  for (const type of ["address", "address-set"]) {
    insertDefinitions(
      session,
      textDocument,
      // <"address" or "address-set">:<zone>:<address-book-name>
      (m) => `${type}:global:${m[3]}`,
      `security\\s+address-book\\s+(\\S+)\\s+${type}\\s+)(\\S+)`,
      (m) => m[4],
    );
  }

  // zone address book mapping
  const pattern = /^\s*set(?:\s+logical-systems\s+(\S+))?\s+.*\s+address-book\s+(\S+)\s+attach\s+zone\s+(\S+)/gm;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text))) {
    session.zoneAddressBooks.set(textDocument.uri, m[1] || "global", m[3], m[2]);
  }
}

function updateZoneSpecificAddressDefinitions(session: Session, textDocument: TextDocument) {
  for (const type of ["address", "address-set"]) {
    insertDefinitions(
      session,
      textDocument,
      // <"address" or "address-set">:<zone>:<address-book-name>
      (m) => `${type}:${m[3]}:global`,
      `security\\s+zones\\s+security-zone\\s+(\\S+)\\s+address-book\\s+${type}\\s+)(\\S+)`,
      (m) => m[4],
    );
  }
}

function updateApplicationDefinitions(session: Session, textDocument: TextDocument) {
  const type = "application";
  insertDefinitions(session, textDocument, type, "applications\\s+application(?:-set)?\\s+)(\\S+)", (m) => m[3]);
}
