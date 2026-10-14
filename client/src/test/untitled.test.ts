import * as assert from "node:assert";

import * as vscode from "vscode";

suite("Should serve unsaved editors", () => {
  test("Diagnoses and completes an untitled Junos document", async () => {
    const ext = vscode.extensions.getExtension("codeout.vscode-junos")!;
    await ext.activate();
    const doc = await vscode.workspace.openTextDocument({
      language: "junos",
      content: "set interfacez xe-0/0/0\nset interfaces xe-0/0/0 \n",
    });
    await vscode.window.showTextDocument(doc);
    assert.equal(doc.uri.scheme, "untitled");

    let diagnostics: vscode.Diagnostic[] = [];
    for (let i = 0; i < 50 && diagnostics.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      diagnostics = vscode.languages.getDiagnostics(doc.uri);
    }
    assert.deepEqual(
      diagnostics.map((d) => d.message),
      ['"interfacez xe-0/0/0" is invalid'],
    );

    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 24),
    );
    assert.ok(list.items.some((item) => item.label === "unit"));
  });
});
