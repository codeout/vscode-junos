import { TextDocumentSyncKind } from "vscode-languageserver/node";

import { completion, completionResolve } from "./completion";
import { definition, updateDefinitions } from "./definition";
import { Session } from "./session";
import { validateTextDocument } from "./validation";

const session = new Session();

session.connection.onInitialize(() => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [" "],
      },
      definitionProvider: true,
    },
  };
});

session.connection.onCompletion(completion(session));
session.connection.onCompletionResolve(completionResolve(session));
session.connection.onDefinition(definition(session));

session.documents.onDidChangeContent((change) => {
  updateDefinitions(session, change.document);
  validateTextDocument(session, change.document);
});

session.listen();
