import * as assert from "node:assert";

import * as vscode from "vscode";

import { activate, getDocUri, state } from "./helper";

suite("Should highlight semantically", () => {
  const docUri = getDocUri("junos-brace.conf");

  // "type[.modifier...]" of the token at the start of `word` in the first occurrence of `needle`
  async function tokenAt(needle: string, word: string) {
    const doc = state.doc!;
    const offset = doc.getText().indexOf(needle);
    assert.ok(offset !== -1, `"${needle}" not found`);
    const position = doc.positionAt(offset + needle.indexOf(word));

    const legend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
      "vscode.provideDocumentSemanticTokensLegend",
      docUri,
    );
    const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
      "vscode.provideDocumentSemanticTokens",
      docUri,
    );

    let line = 0;
    let character = 0;
    const data = tokens?.data ?? [];
    for (let i = 0; i < data.length; i += 5) {
      line += data[i];
      character = data[i] === 0 ? character + data[i + 1] : data[i + 1];
      if (line === position.line && character === position.character) {
        assert.equal(data[i + 2], word.length, `length of "${word}"`);
        const modifiers = legend.tokenModifiers.filter((_, bit) => data[i + 4] & (1 << bit));
        return [legend.tokenTypes[data[i + 3]], ...modifiers].join(".");
      }
    }
    return;
  }

  test("colours words by their role", async () => {
    await activate(docUri);
    for (const [needle, word, expected] of [
      ["policy-statement PS1", "policy-statement", "keyword"],
      ["policy-statement PS1", "PS1", "variable.declaration"],
      ["import PS1", "PS1", "variable"],
      ["term rest", "rest", "variable.declaration"],
      ["instance-type vrf", "vrf", "enumMember"],
      ["address 10.0.0.1/24", "10.0.0.1/24", "number"],
      ["description rr2", "rr2", "string"],
      ["inactive: protocols", "inactive:", "macro"],
      ["apply-groups [ G-IF", "G-IF", "variable"],
      ["apply-groups [ G1 re0", "re0", "variable.defaultLibrary"],
      ["    re0 {", "re0", "variable.declaration.defaultLibrary"],
      ["    ge-0/0/1 {", "ge-0/0/1", "interface.declaration"],
      ["interface ge-0/0/0.0 {", "ge-0/0/0.0", "interface"],
      ["family inet6 {", "inet6", "family"],
      ["family inet6 {", "family", "family"],
      ['family "mpls"', '"mpls"', "family"],
    ]) {
      assert.equal(await tokenAt(needle, word), expected, `${word} in "${needle}"`);
    }
  });

  test("leaves highlighting to the grammar when junos.highlighting is classic", async () => {
    await activate(docUri);
    const config = vscode.workspace.getConfiguration("junos");
    await config.update("highlighting", "classic", vscode.ConfigurationTarget.Global);
    try {
      assert.equal(await tokenAt("policy-statement PS1", "policy-statement"), undefined);
    } finally {
      await config.update("highlighting", undefined, vscode.ConfigurationTarget.Global);
    }
    assert.equal(await tokenAt("policy-statement PS1", "policy-statement"), "keyword");
  });
});
