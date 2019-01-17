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

import {DefinitionStore} from './definition';


export class Session {
    public readonly connection: IConnection;
    public readonly documents: TextDocuments;
    public readonly parser: Parser;
    public readonly definitions: DefinitionStore;

    constructor() {
        this.connection = createConnection(ProposedFeatures.all);
        this.documents = new TextDocuments();
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
