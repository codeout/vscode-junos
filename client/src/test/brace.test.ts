import * as assert from "node:assert";

import * as vscode from "vscode";

import { activate, getDocUri, state } from "./helper";

suite("Should handle curly-brace format", () => {
  test("Diagnoses syntax and references", async () => {
    const docUri = getDocUri("junos-brace.conf");
    await activate(docUri);

    const expected = [
      ["mtuu 9000", '"mtuu 9000" is invalid'],
      ["PS-MISSING", '"PS-MISSING" is not defined'],
      ["ge-0/0/9.0", '"ge-0/0/9.0" is not defined'],
      ["PL-MISSING", '"PL-MISSING" is not defined'],
      ["addr-missing", '"addr-missing" is not defined'],
      ["}\n", 'Unexpected "}"', "last"],
    ].map(([needle, message, which]) => ({ range: rangeOf(needle, which === "last"), message }));

    const actual = vscode.languages.getDiagnostics(docUri);
    const format = (d: { message: string; range: vscode.Range }) =>
      `${d.message} ${d.range.start.line}:${d.range.start.character}-${d.range.end.line}:${d.range.end.character}`;
    assert.deepEqual(
      actual.map((d) => format(d)),
      expected.map((d) => format(d)),
    );
  });

  suite("Completion", () => {
    const docUri = getDocUri("junos-brace-completion.conf");

    test("Completes inside a hierarchy", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(2, 8));
      assert.ok(labels.includes("unit"));
      assert.ok(labels.includes("description"));
      assert.ok(!labels.includes("interfaces"));
    });

    test("Completes the top level", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(19, 0));
      assert.ok(labels.includes("interfaces"));
      assert.ok(labels.includes("policy-options"));
    });

    test("Completes values in a bracket list", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(6, 34));
      assert.ok(labels.includes("password"));
    });

    test("Completes defined prefix-list", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(14, 29));
      assert.deepEqual(labels, ["apply-groups", "apply-groups-except", "RFC1918"]);
    });
  });
});

function rangeOf(needle: string, last = false) {
  const doc = state.doc!;
  const text = doc.getText();
  const start = last ? text.lastIndexOf(needle) : text.indexOf(needle);
  assert.ok(start !== -1, `"${needle}" not found`);
  const length = needle.trimEnd().length;
  return new vscode.Range(doc.positionAt(start), doc.positionAt(start + length));
}

async function completionLabels(docUri: vscode.Uri, position: vscode.Position) {
  await activate(docUri);

  const list = await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    docUri,
    position,
  );
  return list.items
    .map((item) => (typeof item.label === "string" ? item.label : item.label.label))
    .toSorted((a, b) => a.localeCompare(b));
}
