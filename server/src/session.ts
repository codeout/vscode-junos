import { _Connection } from "vscode-languageserver/lib/common/server"; // This is probably internal
import { createConnection, ProposedFeatures, TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DefinitionStore } from "./definition";
import { createParser, Parser } from "./parser";
import { ZoneAddressBookStore } from "./zone_address_book";

export class Session {
  public readonly connection: _Connection;
  public readonly documents: TextDocuments<TextDocument>;
  public readonly parser: Parser;
  public readonly definitions: DefinitionStore;
  public readonly zoneAddressBooks: ZoneAddressBookStore;

  constructor() {
    this.connection = createConnection(ProposedFeatures.all);
    this.documents = new TextDocuments(TextDocument);
    this.parser = createParser();
    this.definitions = new DefinitionStore();
    this.zoneAddressBooks = new ZoneAddressBookStore();
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
