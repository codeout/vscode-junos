import { ProposedFeatures, TextDocuments, createConnection } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { _Connection } from "vscode-languageserver/lib/common/server"; // This is probably internal

import { Parser, createParser } from "./parser";
import { DefinitionStore } from "./definition";

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

  log(...obj: any[]) {
    this.connection.console.log(JSON.stringify(obj));
  }
}
