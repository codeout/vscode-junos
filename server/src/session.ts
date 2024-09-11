import { _Connection } from "vscode-languageserver/lib/common/server"; // This is probably internal
import { createConnection,ProposedFeatures, TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DefinitionStore } from "./definition";
import { createParser,Parser } from "./parser";

export class Session {
  public readonly connection: _Connection;
  public readonly documents: TextDocuments<TextDocument>;
  public readonly parser: Parser;
  public readonly definitions: DefinitionStore;

  constructor() {
    this.connection = createConnection(ProposedFeatures.all);
    this.documents = new TextDocuments(TextDocument);
    this.parser = createParser();
    this.definitions = new DefinitionStore();
  }

  listen() {
    this.documents.listen(this.connection);
    this.connection.listen();
  }

  log(...obj: never[]) {
    this.connection.console.log(JSON.stringify(obj));
  }
}
