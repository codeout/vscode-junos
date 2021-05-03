import {InitializeParams} from 'vscode-languageserver';

import {Session} from './session';
import {
	completion,
	completionResolve,
} from './completion';
import {
	definition,
	updateDefinitions,
} from './definition'
import {validateTextDocument} from './validation';


const session = new Session();

session.connection.onInitialize((params: InitializeParams) => {
	return {
		capabilities: {
			textDocumentSync: session.documents.syncKind,
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: [' ']
			},
			definitionProvider: true,
		}
	};
});

session.connection.onCompletion(completion(session));
session.connection.onCompletionResolve(completionResolve(session));
session.connection.onDefinition(definition(session));

session.documents.onDidChangeContent(change => {
	updateDefinitions(session, change.document);
	validateTextDocument(session, change.document);
});

session.listen();
