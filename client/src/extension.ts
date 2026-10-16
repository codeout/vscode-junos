import * as path from "node:path";

import type { ExtensionContext } from "vscode";
import { commands, ViewColumn, window, workspace } from "vscode";
import type { LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";

const state: { client?: LanguageClient } = {};

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Saved files and unsaved (untitled) editors in Junos mode
    documentSelector: [
      { scheme: "file", language: "junos" },
      { scheme: "untitled", language: "junos" },
    ],
    synchronize: {
      // Tell the server when junos.* settings change
      configurationSection: "junos",
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // Create the language client and start the client.
  state.client = new LanguageClient("JunoslanguageServer", "Language Server for Junos", serverOptions, clientOptions);

  // Start the client. This will also launch the server
  state.client.start();

  context.subscriptions.push(commands.registerCommand("junos.convertToSet", convertToSet));
}

/**
 * The active Junos editor as "set" commands, in a new editor
 */
async function convertToSet() {
  const editor = window.activeTextEditor;
  if (!editor || editor.document.languageId !== "junos" || !state.client) {
    return;
  }
  const content = await state.client.sendRequest<string | null>("junos/convertToSet", {
    uri: editor.document.uri.toString(),
  });
  if (content === null) {
    return;
  }
  const doc = await workspace.openTextDocument({ language: "junos", content });
  await window.showTextDocument(doc, ViewColumn.Beside);
}

export function deactivate() {
  if (!state.client) {
    return;
  }
  return state.client.stop();
}
