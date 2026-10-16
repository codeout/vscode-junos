import * as assert from "node:assert";

import * as vscode from "vscode";

import { activate, getDocUri, state } from "./helper";

suite("Should handle curly-brace format", () => {
  test("Diagnoses syntax and references", async () => {
    const docUri = getDocUri("junos-brace.conf");
    await activate(docUri);

    const expected = [
      ["VRF-GONE", '"VRF-GONE" is not defined'],
      ["G-MTU", '"G-MTU" is not defined'],
      ["mtuu 9000", '"mtuu 9000" is invalid'],
      ["unit 5", "unit 5 is defined more than once in ge-0/0/2"],
      ["unit 5", "unit 5 is defined more than once in ge-0/0/2", "last"],
      ["VRF-MISSING", '"VRF-MISSING" is not defined'],
      ["PS-MISSING", '"PS-MISSING" is not defined'],
      ["ge-0/0/9.0", '"ge-0/0/9.0" is not defined'],
      ["PL-MISSING", '"PL-MISSING" is not defined'],
      [
        "^target:65000:.*$",
        '"^target:65000:.*$" is a regular expression on an extended community, which vrf-import policies do not support (used by vrf-import PS-RE)',
      ],
      [
        "PS-RE",
        'Policy "PS-RE" matches extended communities by regular expression (RT-RE), which vrf-import does not support',
        "last",
      ],
      ["inactive: protocols {\n    rip;\n}", "Inactive: Junos does not apply it"],
      ["addr-missing", '"addr-missing" is not defined'],
      ["}\n", 'Unexpected "}"', "last"],
    ].map(([needle, message, which]) => ({ range: rangeOf(needle, which === "last"), message }));

    // "## Warning:": from the start of the first "##" line to the end of fxp0 { ... }
    const doc = state.doc!;
    const warningLine = doc.positionAt(doc.getText().indexOf("## Warning:")).line;
    expected.push({
      range: new vscode.Range(warningLine - 1, 0, warningLine + 4, doc.lineAt(warningLine + 4).text.length),
      message: "Junos: statement ignored: unsupported platform (srx300)",
    });
    expected.sort((a, b) => a.range.start.compareTo(b.range.start));

    const actual = vscode.languages.getDiagnostics(docUri);
    const format = (d: { message: string; range: vscode.Range }) =>
      `${d.message} ${d.range.start.line}:${d.range.start.character}-${d.range.end.line}:${d.range.end.character}`;
    assert.deepEqual(
      actual.map((d) => format(d)),
      expected.map((d) => format(d)),
    );
  });

  suite("Go to definition", () => {
    const docUri = getDocUri("junos-brace.conf");

    for (const [title, reference, definition, symbol] of [
      ["policy-statement", "import PS1", "policy-statement PS1", "PS1"],
      ["policy-statement in a bracket list", "export [ PS1", "policy-statement PS1", "PS1"],
      ["prefix-list", "prefix-list RFC1918;", "prefix-list RFC1918 {", "RFC1918"],
      ["prefix-list-filter", "prefix-list-filter RFC1918", "prefix-list RFC1918 {", "RFC1918"],
      ["apply-groups", "apply-groups [ G1", "    G1 {", "G1"],
      ["apply-groups in a bracket list", "apply-groups [ G-IF", "    G-IF {", "G-IF"],
      ["interface unit", "interface ge-0/0/0.0", "        unit 0 {", "unit 0"],
      ["vrf-import in a bracket list", "vrf-import [ PS1", "policy-statement PS1", "PS1"],
      ["vrf-export", "vrf-export PS1", "policy-statement PS1", "PS1"],
      ["rib-groups import-policy", "import-policy PS1", "policy-statement PS1", "PS1"],
      ["community add", "community add C1", "community C1 members", "C1"],
      ["aggregate-label community", "community C1;", "community C1 members", "C1"],
      ["l2circuit community", "community C3;", "community C3 members", "C3"],
      ["routing-instance of a next-table", "next-table VRF1", "    VRF1 {", "VRF1"],
      ["routing-instance statement", "routing-instance VRF1", "    VRF1 {", "VRF1"],
    ]) {
      test(title, async () => {
        await activate(docUri);
        const text = state.doc!.getText();
        const position = state.doc!.positionAt(text.indexOf(reference) + reference.lastIndexOf(" ") + 2);

        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
          "vscode.executeDefinitionProvider",
          docUri,
          position,
        );

        const expected = state.doc!.positionAt(text.indexOf(definition) + definition.indexOf(symbol));
        assert.equal(locations.length, 1);
        assert.deepEqual(locations[0].range.start, expected);
      });
    }
  });

  suite("Find all references", () => {
    const docUri = getDocUri("junos-brace.conf");

    for (const [title, from, symbol, uses] of [
      ["from a community definition", "community C1 members", "C1", ["community C1;", "community add C1"]],
      ["from a community reference", "community add C1", "C1", ["community C1;", "community add C1"]],
      [
        "from a prefix-list definition",
        "prefix-list RFC1918 {",
        "RFC1918",
        ["prefix-list RFC1918;", "prefix-list-filter RFC1918"],
      ],
      ["from a prefix-list-filter", "prefix-list-filter RFC1918", "RFC1918", ["prefix-list RFC1918;"]],
      ["from a group definition", "    G-IF {", "G-IF", ["apply-groups [ G-IF"]],
      ["from a policy-statement definition", "policy-statement PS1 {", "PS1", ["import PS1", "export [ PS1"]],
      ["from a routing-instance definition", "    VRF1 {", "VRF1", ["next-table VRF1", "routing-instance VRF1"]],
    ] as Array<[string, string, string, string[]]>) {
      test(title, async () => {
        await activate(docUri);
        const doc = state.doc!;
        const text = doc.getText();
        const at = (needle: string) => {
          const i = text.indexOf(needle);
          assert.ok(i !== -1, `"${needle}" not found`);
          return doc.positionAt(i + needle.lastIndexOf(symbol));
        };

        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
          "vscode.executeReferenceProvider",
          docUri,
          at(from).translate(0, 1),
        );

        const found = locations.map((l) => l.range.start);
        for (const use of uses) {
          assert.ok(
            found.some((p) => p.isEqual(at(use))),
            `${use} missing in ${JSON.stringify(found)}`,
          );
        }
        for (const l of locations) {
          assert.equal(doc.getText(l.range), symbol);
        }
      });
    }
  });

  test("Show incoming calls: uses with the statements they are in", async () => {
    const docUri = getDocUri("junos-brace.conf");
    await activate(docUri);
    const doc = state.doc!;
    const text = doc.getText();
    const position = doc.positionAt(text.indexOf("prefix-list RFC1918 {") + "prefix-list ".length + 1);

    const [item] = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      "vscode.prepareCallHierarchy",
      docUri,
      position,
    );
    assert.equal(item.name, "RFC1918");
    const calls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
      "vscode.provideIncomingCalls",
      item,
    );
    const callers = calls.map((c) => `${c.from.name} | ${c.from.detail}`);
    assert.deepEqual(callers, [
      "policy-statement PS1 › term rf | from prefix-list",
      "policy-statement PS1 › term rf | from prefix-list-filter",
    ]);

    // expanding a use inside policy-statement PS1 lists the uses of PS1
    const next = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
      "vscode.provideIncomingCalls",
      calls[0].from,
    );
    assert.ok(
      next.some((c) => c.from.name === "RG1" || c.from.name.endsWith("RG1")),
      JSON.stringify(next.map((c) => c.from.name)),
    );
  });

  suite("Hover", () => {
    const docUri = getDocUri("junos-brace.conf");

    const hoverText = async (needle: string, word: string) => {
      await activate(docUri);
      const doc = state.doc!;
      const position = doc.positionAt(doc.getText().indexOf(needle) + needle.indexOf(word) + 1);
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        docUri,
        position,
      );
      return hovers
        .flatMap((h) => h.contents)
        .map((c) => (typeof c === "string" ? c : c.value))
        .join("\n");
    };

    test("shows the help text of a keyword", async () => {
      assert.match(await hoverText("vrf-import [ PS1", "vrf-import"), /^\*\*vrf-import\*\* — \S/);
      assert.match(
        await hoverText("route-distinguisher 65000:1", "route-distinguisher"),
        /^\*\*route-distinguisher\*\*/,
      );
    });

    test("shows nothing in a comment", async () => {
      assert.equal(await hoverText("/* annotation */", "annotation"), "");
    });
  });

  suite("Rename", () => {
    const docUri = getDocUri("junos-brace.conf");

    for (const [title, from, symbol, newName, places] of [
      ["a community", "community add C1", "C1", "C9", ["community C1 members", "community C1;", "community add C1"]],
      [
        "a routing-instance",
        "routing-instance VRF1",
        "VRF1",
        "BLUE",
        ["    VRF1 {", "next-table VRF1", "routing-instance VRF1"],
      ],
    ] as Array<[string, string, string, string, string[]]>) {
      test(title, async () => {
        await activate(docUri);
        const doc = state.doc!;
        const text = doc.getText();
        const at = (needle: string) => doc.positionAt(text.indexOf(needle) + needle.lastIndexOf(symbol));

        const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
          "vscode.executeDocumentRenameProvider",
          docUri,
          at(from).translate(0, 1),
          newName,
        );

        const edits = edit.get(docUri);
        for (const e of edits) {
          assert.equal(doc.getText(e.range), symbol);
          assert.equal(e.newText, newName);
        }
        for (const place of places) {
          assert.ok(
            edits.some((e) => e.range.start.isEqual(at(place))),
            `${place} not renamed`,
          );
        }
      });
    }

    test("refuses interfaces", async () => {
      await activate(docUri);
      const text = state.doc!.getText();
      const position = state.doc!.positionAt(text.indexOf("interface ge-0/0/9.0") + 12);
      await assert.rejects(Promise.resolve(vscode.commands.executeCommand("vscode.prepareRename", docUri, position)));
    });
  });

  suite("Completion", () => {
    const docUri = getDocUri("junos-brace-completion.conf");

    test("Leaves out hidden statements when junos.completion.hiddenStatements is off", async () => {
      const position = new vscode.Position(31, 4);
      const config = vscode.workspace.getConfiguration("junos");
      const all = await completionLabels(docUri, position);
      await config.update("completion.hiddenStatements", false, vscode.ConfigurationTarget.Global);
      try {
        const visible = await completionLabels(docUri, position);
        assert.ok(visible.includes("static"));
        assert.ok(visible.every((label) => all.includes(label)));
        // hidden in the CLI; only schemas built from DDL have it at all
        assert.ok(!visible.includes("chained-multi-family-lookup"));
      } finally {
        await config.update("completion.hiddenStatements", undefined, vscode.ConfigurationTarget.Global);
      }
    });

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

    test("Completes routing tables of defined instances", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(27, 36));
      assert.ok(labels.includes("VRF7.inet.0"));
      assert.ok(labels.includes("VRF7.inet6.0"));
    });

    test("Completes values in a bracket list", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(6, 34));
      assert.ok(labels.includes("password"));
    });

    test("Completes defined prefix-list", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(14, 29));
      assert.deepEqual(labels, ["apply-groups", "apply-groups-except", "RFC1918"]);
    });

    test("Completes defined groups in apply-groups", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(45, 13));
      assert.ok(labels.includes("G-C"));
    });

    test("Completes defined prefix-list in prefix-list-filter", async () => {
      const labels = await completionLabels(docUri, new vscode.Position(35, 32));
      assert.ok(labels.includes("RFC1918"));
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
