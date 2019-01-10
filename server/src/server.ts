'use strict';

import {InitializeParams} from 'vscode-languageserver';

import {Session} from './session';
import {
	completion,
	completionResolve,
} from './completion';
import {validateTextDocument} from './validation';


const session = new Session();

session.connection.onInitialize((params: InitializeParams) => {
	return {
		capabilities: {
			textDocumentSync: session.documents.syncKind,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: [' ']
			}
		}
	};
});

session.connection.onCompletion(completion(session));
session.connection.onCompletionResolve(completionResolve(session));

session.documents.onDidChangeContent(change => {
	validateTextDocument(session, change.document);
});

session.listen();
