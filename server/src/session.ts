import type { _Connection } from "vscode-languageserver/lib/common/server"; // This is probably internal
import { createConnection, ProposedFeatures, TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import type { BraceParse } from "./config";
import { ConfigView, parseBraces } from "./config";
import { DefinitionStore } from "./definition";
import { configuredStatements, inheritGroups } from "./groups";
import type { Parser } from "./parser";
import { createParser } from "./parser";
import { ZoneAddressBookStore } from "./zone-address-book";

export class Session {
  public readonly connection: _Connection;
  public readonly documents: TextDocuments<TextDocument>;
  public readonly parser: Parser;
  public readonly definitions: DefinitionStore;
  public readonly zoneAddressBooks: ZoneAddressBookStore;
  private readonly views = new Map<
    string,
    { version: number; braces: BraceParse; view: ConfigView; inherited: ConfigView }
  >();

  constructor() {
    this.connection = createConnection(ProposedFeatures.all);
    this.documents = new TextDocuments(TextDocument);
    this.parser = createParser();
    this.definitions = new DefinitionStore();
    this.zoneAddressBooks = new ZoneAddressBookStore();
  }

  /**
   * Curly-brace statements of the document, its text with those statements appended as "set" lines, and
   * the statements it inherits from configuration groups as "set" lines of their own
   */
  analyze(document: { uri: string; version: number; getText(): string }) {
    const cached = this.views.get(document.uri);
    if (cached?.version === document.version) {
      return cached;
    }

    const text = document.getText();
    const braces = parseBraces(text);
    const { statements } = inheritGroups(configuredStatements(text, braces.statements));
    const entry = {
      version: document.version,
      braces,
      view: new ConfigView(text, braces.statements),
      inherited: new ConfigView("", statements),
    };
    this.views.set(document.uri, entry);
    return entry;
  }

  forget(uri: string) {
    this.views.delete(uri);
  }

  listen() {
    this.documents.listen(this.connection);
    this.connection.listen();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(...obj: any[]) {
    this.connection.console.log(JSON.stringify(obj));
  }
}
