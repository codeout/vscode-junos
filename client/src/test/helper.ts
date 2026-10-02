import * as path from "node:path";

import * as vscode from "vscode";

export const state: { doc?: vscode.TextDocument; editor?: vscode.TextEditor } = {};
export let documentEol: string;
export let platformEol: string;

/**
 * Activates the vscode.lsp-sample extension
 */
export async function activate(docUri: vscode.Uri) {
  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension("codeout.vscode-junos")!;
  await ext.activate();
  try {
    state.doc = await vscode.workspace.openTextDocument(docUri);
    state.editor = await vscode.window.showTextDocument(state.doc);
    await sleep(2000); // Wait for server activation
  } catch (error) {
    console.error(error);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const getDocPath = (p: string) => {
  return path.resolve(__dirname, "../../testFixture", p);
};
export const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p));
};

export async function setTestContent(content: string) {
  const doc = state.doc!;
  const all = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
  // eslint-disable-next-line unicorn/no-unsafe-string-replacement -- TextEditorEdit#replace, not String#replace
  return state.editor!.edit((eb) => eb.replace(all, content));
}
