import {
  Definition,
  Location,
  Range,
  RequestHandler,
  TextDocument,
  TextDocumentPositionParams,
} from "vscode-languageserver";

import { Session } from "./session";
import { prefixPattern } from "./parser";

export class DefinitionStore {
  private readonly store: {
    [uri: string]: {
      [symbolType: string]: {
        [symbol: string]: Range[];
      };
    };
  };

  constructor() {
    this.store = {};
  }

  set(uri: string, symbolType: string, symbol: string, definition: Range): void {
    // initialize
    this.store[uri] = this.store[uri] || {};
    this.store[uri][symbolType] = this.store[uri][symbolType] || {};
    this.store[uri][symbolType][symbol] = this.store[uri][symbolType][symbol] || [];

    this.store[uri][symbolType][symbol].push(definition);
  }

  /**
   * Return definition, [] when a given symbol is not defined, undefined when the symbol is undefined.
   * NOTE: It's important to return undefined in the last case to chain findings.
   *
   * @param uri
   * @param symbolType
   * @param symbol
   */
  get(uri: string, symbolType: string, symbol: string | undefined): Range[] | undefined {
    if (!symbol) {
      return;
    }

    if (!this.store[uri] || !this.store[uri][symbolType]) {
      return [];
    } else {
      return this.store[uri][symbolType][symbol] || [];
    }
  }

  /**
   * Return all symbol definitions for the given symbolType.
   *
   * @param uri
   * @param symbolType
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  getDefinitions(uri: string, symbolType: string): Object {
    return this.store[uri] ? this.store[uri][symbolType] : {};
  }

  clear(uri: string, symbolType: string): void {
    if (this.store[uri]) {
      this.store[uri][symbolType] = {};
    }
  }
}

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
function getPointedSymbol(session: Session, line: string, position: number, pattern: string): string | undefined {
  const match = line.match(`(${prefixPattern.source}(?:\\s+.*)?\\s+${pattern}\\s+)(\\S+)`);

  // Return nothing when the cursor doesn't point at the keyword
  if (!match || match[0].length < position || match[1].length > position) {
    return;
  } else {
    return match[2];
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

export function updateDefinitions(session: Session, textDocument: TextDocument): void {
  updateInterfaceDefinitions(session, textDocument);
  updatePrefixListDefinitions(session, textDocument);
  updatePolicyStatementDefinitions(session, textDocument);
  updateCommunityDefinitions(session, textDocument);
  updateAsPathDefinitions(session, textDocument);
  updateAsPathGroupDefinitions(session, textDocument);
  updateFirewallFilterDefinitions(session, textDocument);
  updateNatPoolDefinitions(session, textDocument);
}

function insertDefinitions(
  session: Session,
  textDocument: TextDocument,
  symbolType: string,
  pattern: string,
  modifyFunction: (arg: RegExpExecArray) => string,
): void {
  const text = textDocument.getText();

  // FIXME: We should have implemented with named captures, but avoid them due to performance consideration
  const fullPattern = new RegExp(`(${prefixPattern.source}\\s+${pattern}`, "gm");
  let m: RegExpExecArray | null;

  while ((m = fullPattern.exec(text))) {
    const symbol = modifyFunction(m);
    session.definitions.set(textDocument.uri, symbolType, symbol, {
      start: textDocument.positionAt(m.index + m[1].length),
      end: textDocument.positionAt(m.index + m[0].length),
    });
  }
}

function updateInterfaceDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "interface";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "interfaces\\s+)(\\S+)", (m) => m[2]);
  insertDefinitions(
    session,
    textDocument,
    type,
    "interfaces\\s+)(\\S+)\\s+unit\\s+([0-9]+)",
    (m) => `${m[2]}.${m[3]}`, // "xe-0/0/0 unit 0" is referred as "xe-0/0/0.0"
  );
}

function updatePrefixListDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "prefix-list";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+prefix-list\\s+)(\\S+)", (m) => m[2]);
}

function updatePolicyStatementDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "policy-statement";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+policy-statement\\s+)(\\S+)", (m) => m[2]);
}

function updateCommunityDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "community";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+community\\s+)(\\S+)", (m) => m[2]);
}

function updateAsPathDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "as-path";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+as-path\\s+)(\\S+)", (m) => m[2]);
}

function updateAsPathGroupDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "as-path-group";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "policy-options\\s+as-path-group\\s+)(\\S+)", (m) => m[2]);
}

function updateFirewallFilterDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "firewall-filter";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "firewall(?:\\s+family\\s+\\S+)?\\s+filter\\s+)(\\S+)", (m) => m[2]);
}

function updateNatPoolDefinitions(session: Session, textDocument: TextDocument): void {
  const type = "nat-pool";
  session.definitions.clear(textDocument.uri, type);
  insertDefinitions(session, textDocument, type, "services\\s+nat\\s+pool\\s+)(\\S+)", (m) => m[2]);
}
