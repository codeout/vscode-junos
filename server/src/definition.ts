import { Definition, Location, Range, RequestHandler, TextDocumentPositionParams } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { prefixPattern } from "./parser";
import { Session } from "./session";

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

  set(uri: string, logicalSystem: string, symbolType: string, symbol: string, definition: Range): void {
    // initialize
    this.store[uri] ||= {};
    this.store[uri][logicalSystem] ||= {};
    this.store[uri][logicalSystem][symbolType] ||= {};
    this.store[uri][logicalSystem][symbolType][symbol] ||= [];

    this.store[uri][logicalSystem][symbolType][symbol].push(definition);
  }

  /**
   * Return definition, [] when a given symbol is not defined, undefined when the symbol is undefined.
   * NOTE: It's important to return undefined in the last case to chain findings.
   *
   * @param uri
   * @param symbolType
   * @param symbol
   */
  get(uri: string, symbolType: string, symbol: PointedSymbol): Range[] | undefined {
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
  getDefinitions(uri: string, logicalSystem: string, symbolType: string): object {
    return this.store[uri]?.[logicalSystem]?.[symbolType] || {};
  }

  clear(uri: string, symbolType: string): void {
    if (!this.store[uri]) {
      return;
    }

    for (const logicalSystem in this.store[uri]) {
      this.store[uri][logicalSystem][symbolType] = {};
    }
  }
}

type PointedSymbol = {
  logicalSystem: string;
  symbol?: string;
};

export function definition(session: Session): RequestHandler<TextDocumentPositionParams, Definition, void> {
  return (textDocumentPosition: TextDocumentPositionParams): Definition => {
    const doc = session.documents.get(textDocumentPosition.textDocument.uri);
    if (!doc) {
      return [];
    }

    const line = doc.getText().split("\n")[textDocumentPosition.position.line];

    const definition =
      getInterfaceDefinition(session, line, textDocumentPosition) ||
      getPrefixListDefinition(session, line, textDocumentPosition) ||
      getPolicyStatementDefinition(session, line, textDocumentPosition) ||
      getCommunityDefinition(session, line, textDocumentPosition) ||
      getAsPathDefinition(session, line, textDocumentPosition) ||
      getAsPathGroupDefinition(session, line, textDocumentPosition) ||
      getFirewallFilterDefinition(session, line, textDocumentPosition) ||
      getNatPoolDefinition(session, line, textDocumentPosition) ||
      getMatchAddressDefinition(session, line, textDocumentPosition) ||
      getPoolAddressDefinition(session, line, textDocumentPosition) ||
      [];

    return definition.map((d) => Location.create(textDocumentPosition.textDocument.uri, d));
  };
}

/**
 * Return if the cursor is pointing the symbol which matches a given pattern, or undefined.
 *
 * @param session
 * @param line
 * @param position
 * @param pattern
 */
function getPointedSymbol(session: Session, line: string, position: number, pattern: string): PointedSymbol {
  const m = line.match(
    `(${prefixPattern.source}(?:\\s+logical-systems\\s+(\\S+))?(?:\\s+.*)?\\s+${pattern}\\s+)(\\S+)`,
  );

  // Return nothing when the cursor doesn't point at the keyword
  if (!m || m[0].length < position || m[1].length > position) {
    return { logicalSystem: "global" };
  } else {
    return { logicalSystem: m[2] || "global", symbol: m[3] };
  }
}

function getInterfaceDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(session, line, textDocumentPosition.position.character, "interface");
  return session.definitions.get(textDocumentPosition.textDocument.uri, "interface", symbol);
}

function getPrefixListDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(
    session,
    line,
    textDocumentPosition.position.character,
    "from\\s+(?:source-|destination-)?prefix-list",
  );
  return session.definitions.get(textDocumentPosition.textDocument.uri, "prefix-list", symbol);
}

function getPolicyStatementDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(session, line, textDocumentPosition.position.character, "(?:import|export)");
  return session.definitions.get(textDocumentPosition.textDocument.uri, "policy-statement", symbol);
}

function getCommunityDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(
    session,
    line,
    textDocumentPosition.position.character,
    "(?:from\\s+community|then\\s+community\\s+(?:add|delete|set))",
  );
  return session.definitions.get(textDocumentPosition.textDocument.uri, "community", symbol);
}

function getAsPathDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(session, line, textDocumentPosition.position.character, "from\\s+as-path");
  return session.definitions.get(textDocumentPosition.textDocument.uri, "as-path", symbol);
}

function getAsPathGroupDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(session, line, textDocumentPosition.position.character, "from\\s+as-path-group");
  return session.definitions.get(textDocumentPosition.textDocument.uri, "as-path-group", symbol);
}

function getFirewallFilterDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(
    session,
    line,
    textDocumentPosition.position.character,
    "filter\\s+(?:input|output|input-list|output-list)",
  );
  return session.definitions.get(textDocumentPosition.textDocument.uri, "firewall-filter", symbol);
}

function getNatPoolDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(
    session,
    line,
    textDocumentPosition.position.character,
    "then\\s+translated\\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)",
  );
  return session.definitions.get(textDocumentPosition.textDocument.uri, "nat-pool", symbol);
}

function getMatchAddressDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(
    session,
    line,
    textDocumentPosition.position.character,
    "match\\s+(?:source|destination)-address(?:-name)?",
  );
  return session.definitions.get(textDocumentPosition.textDocument.uri, "address:global", symbol);
}

function getPoolAddressDefinition(
  session: Session,
  line: string,
  textDocumentPosition: TextDocumentPositionParams,
): Range[] | undefined {
  const symbol = getPointedSymbol(
    session,
    line,
    textDocumentPosition.position.character,
    "pool\\s+\\S+\\s+address-name",
  );
  return session.definitions.get(textDocumentPosition.textDocument.uri, "address:global", symbol);
}

export function updateDefinitions(session: Session, textDocument: TextDocument): void {
  updateInterfaceDefinitions(session, textDocument);
  updatePrefixListDefinitions(session, textDocument);
  updatePolicyStatementDefinitions(session, textDocument);
  updateCommunityDefinitions(session, textDocument);
  updateAsPathDefinitions(session, textDocument);
  updateAsPathGroupDefinitions(session, textDocument);
  updateFirewallFilterDefinitions(session, textDocument);
  updateNatPoolDefinitions(session, textDocument);
  updateAddressDefinitions(session, textDocument);
}

function insertDefinitions(
  session: Session,
  textDocument: TextDocument,
  symbolType: string | ((arg: RegExpExecArray) => string),
  pattern: string,
  modifyFunction: (arg: RegExpExecArray) => string,
): void {
  const text = textDocument.getText();

  // FIXME: We should have implemented with named captures, but avoid them due to performance consideration
  const fullPattern = new RegExp(`(${prefixPattern.source}(?:\\s+logical-systems\\s+(\\S+))?\\s+${pattern}`, "gm");
  let m: RegExpExecArray | null;

  while ((m = fullPattern.exec(text))) {
    const type = typeof symbolType === "function" ? symbolType(m) : symbolType;
    const symbol = modifyFunction(m);
    session.definitions.set(textDocument.uri, m[2] || "global", type, symbol, {
      start: textDocument.positionAt(m.index + m[1].length),
      end: textDocument.positionAt(m.index + m[0].length),
    });
  }
}

function updateInterfaceDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "interface";
  session.definitions.clear(textDocument.uri, type);
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

function updatePrefixListDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "prefix-list";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+prefix-list\\s+)(\\S+)", (m) => m[3]);
}

function updatePolicyStatementDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "policy-statement";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+policy-statement\\s+)(\\S+)", (m) => m[3]);
}

function updateCommunityDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "community";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+community\\s+)(\\S+)", (m) => m[3]);
}

function updateAsPathDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "as-path";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+as-path\\s+)(\\S+)", (m) => m[3]);
}

function updateAsPathGroupDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "as-path-group";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+as-path-group\\s+)(\\S+)", (m) => m[3]);
}

function updateFirewallFilterDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "firewall-filter";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "firewall(?:\\s+family\\s+\\S+)?\\s+filter\\s+)(\\S+)", (m) => m[3]);
}

function updateNatPoolDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "nat-pool";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "services\\s+nat\\s+pool\\s+)(\\S+)", (m) => m[3]);
}

function updateAddressDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "address";

  const text = textDocument.getText();
  const pattern = /security\s+address-book\s+(\S+)/gm;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    session.definitions.clear(textDocument.uri, `${type}:${m[1]}`);
  }

  insertDefinitions(
    session,
    textDocument,
    (m) => `${type}:${m[3]}`,
    "security\\s+address-book\\s+(\\S+)\\s+address\\s+)(\\S+)",
    (m) => m[4],
  );
}
