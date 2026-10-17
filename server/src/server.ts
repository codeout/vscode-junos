import type { DocumentDiagnosticReport } from "vscode-languageserver";
import { DocumentDiagnosticReportKind } from "vscode-languageserver";
import { TextDocumentSyncKind } from "vscode-languageserver/node";

import { completion, completionResolve } from "./completion";
import { toSetCommands } from "./convert";
import { definition, updateDefinitions } from "./definition";
import { incomingCalls, outgoingCalls, prepareCallHierarchy } from "./hierarchy";
import { hover } from "./hover";
import { forgetReferences, prepareRename, references, rename } from "./references";
import { legend, semanticTokens } from "./semantic";
import { Session } from "./session";
import { forgetTree } from "./tree";
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
      hoverProvider: true,
      semanticTokensProvider: { legend, full: true },
      referencesProvider: true,
      renameProvider: { prepareProvider: true },
      callHierarchyProvider: true,
    },
  };
});

session.connection.onCompletion(completion(session));
session.connection.onCompletionResolve(completionResolve(session));
session.connection.onDefinition(definition(session));
session.connection.onHover(hover(session));
session.connection.languages.semanticTokens.on(semanticTokens(session));

// junos.highlighting may have switched between semantic and classic highlighting
session.connection.onDidChangeConfiguration(() => {
  session.connection.languages.semanticTokens.refresh();
});
session.connection.onReferences(references(session));

// "Junos: Convert to set commands"
session.connection.onRequest("junos/convertToSet", (params: { uri: string }) => {
  const doc = session.documents.get(params.uri);
  return doc ? toSetCommands(doc.getText(), session.analyze(doc).braces.statements, session.parser) : null;
});
session.connection.onPrepareRename(prepareRename(session));
session.connection.languages.callHierarchy.onPrepare(prepareCallHierarchy(session));
session.connection.languages.callHierarchy.onIncomingCalls(incomingCalls(session));
session.connection.languages.callHierarchy.onOutgoingCalls(outgoingCalls(session));
session.connection.onRenameRequest(rename(session));

session.connection.languages.diagnostics.on(async (params) => {
  const document = session.documents.get(params.textDocument.uri);
  if (document !== undefined) {
    return {
      kind: DocumentDiagnosticReportKind.Full,
      items: await validateTextDocument(session, document),
    } satisfies DocumentDiagnosticReport;
  }
  // We don't know the document. We can either try to read it from disk
  // or we don't report problems for it.
  return {
    kind: DocumentDiagnosticReportKind.Full,
    items: [],
  } satisfies DocumentDiagnosticReport;
});

session.documents.onDidChangeContent((change) => {
  updateDefinitions(session, change.document);
  validateTextDocument(session, change.document);
});

session.documents.onDidClose((event) => {
  session.forget(event.document.uri);
  forgetReferences(event.document.uri);
  forgetTree(event.document.uri);
});

session.listen();
