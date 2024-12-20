import { DocumentDiagnosticReport, DocumentDiagnosticReportKind } from "vscode-languageserver";
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
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
      definitionProvider: true,
    },
  };
});

session.connection.onCompletion(completion(session));
session.connection.onCompletionResolve(completionResolve(session));
session.connection.onDefinition(definition(session));

session.connection.languages.diagnostics.on(async (params) => {
  const document = session.documents.get(params.textDocument.uri);
  if (document !== undefined) {
    return {
      kind: DocumentDiagnosticReportKind.Full,
      items: await validateTextDocument(session, document),
    } satisfies DocumentDiagnosticReport;
  } else {
    // We don't know the document. We can either try to read it from disk
    // or we don't report problems for it.
    return {
      kind: DocumentDiagnosticReportKind.Full,
      items: [],
    } satisfies DocumentDiagnosticReport;
  }
});

session.documents.onDidChangeContent((change) => {
  updateDefinitions(session, change.document);
  validateTextDocument(session, change.document);
});

session.listen();
