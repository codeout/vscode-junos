'use strict';

import {
    createConnection,
    IConnection,
    ProposedFeatures,
    TextDocuments,
} from 'vscode-languageserver';

import {
    Parser,
    createParser,
} from './parser';


export class Session {
    public readonly connection: IConnection;
    public readonly documents: TextDocuments;
    public readonly parser: Parser;
    public readonly definitions: Object;

    constructor() {
        this.connection = createConnection(ProposedFeatures.all);
        this.documents = new TextDocuments();
        this.parser = createParser();
        this.definitions = {};
    }

    listen() {
        this.documents.listen(this.connection);
        this.connection.listen();
    }
}
