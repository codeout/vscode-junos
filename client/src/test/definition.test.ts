import * as assert from "node:assert";

import * as vscode from "vscode";

import { activate, getDocUri, state } from "./helper";

suite("Should go to definition", () => {
  const docUri = getDocUri("junos.conf");

  for (const [title, reference, definition] of [
    ["vrf-import", "vrf-import foo-statement", "policy-statement foo-statement from"],
    ["vrf-export in a bracket list", "vrf-export [ foo-statement", "policy-statement foo-statement from"],
    ["network-summary-export", "network-summary-export foo-statement", "policy-statement foo-statement from"],
    ["prefix-list-filter", "prefix-list-filter foo-prefix", "prefix-list foo-prefix 10.0.0.0/8"],
    ["source-prefix-list", "source-prefix-list foo-prefix", "prefix-list foo-prefix 10.0.0.0/8"],
    ["destination-prefix-list", "destination-prefix-list foo-prefix", "prefix-list foo-prefix 10.0.0.0/8"],
    ["from community", "from community foo-community", "community foo-community members"],
    ["l2circuit community", "xe-0/0/0.0 community foo-community\n", "community foo-community members"],
    ["aggregate-label community", "aggregate-label community foo-community", "community foo-community members"],
    ["routing-instance of a next-table", "next-table foo-instance", "routing-instances foo-instance instance-type"],
    ["routing-instance statement", "routing-instance foo-instance", "routing-instances foo-instance instance-type"],
  ]) {
    test(title, async () => {
      await activate(docUri);
      const text = state.doc!.getText();
      const symbol = reference.trimEnd().split(" ").at(-1)!;
      const start = text.indexOf(reference);
      assert.ok(start !== -1, `"${reference}" not found`);
      const position = state.doc!.positionAt(start + reference.lastIndexOf(symbol) + 1);

      const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeDefinitionProvider",
        docUri,
        position,
      );

      // A "set" style definition is repeated on each line that configures it
      const expected = state.doc!.positionAt(text.indexOf(definition) + definition.indexOf(symbol));
      assert.ok(locations.some((l) => l.range.start.isEqual(expected)));
      for (const l of locations) {
        assert.equal(state.doc!.getText(l.range), symbol);
      }
    });
  }
});
