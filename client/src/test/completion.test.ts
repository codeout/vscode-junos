import * as assert from "node:assert";

import * as vscode from "vscode";

import { activate, getDocUri } from "./helper";

suite("Should do completion", () => {
  const docUri = getDocUri("junos.conf");

  // Keywords both the checked-in schema (XSD) and a DDL-built schema have
  const rootItems = [
    "access",
    "applications",
    "apply-groups",
    "apply-groups-except",
    "chassis",
    "class-of-service",
    "firewall",
    "forwarding-options",
    "interfaces",
    "logical-systems",
    "policy-options",
    "protocols",
    "routing-instances",
    "routing-options",
    "security",
    "services",
    "snmp",
    "system",
  ].map((label) => ({ label, kind: vscode.CompletionItemKind.Text }));

  test("Completes root config section", async () => {
    await testCompletion(docUri, new vscode.Position(2, 4), {
      items: [...rootItems, { label: "groups", kind: vscode.CompletionItemKind.Text }].toSorted((a, b) =>
        a.label.localeCompare(b.label),
      ),
    });
  });

  test("Completes interfaces section", async () => {
    await testCompletion(docUri, new vscode.Position(3, 24), {
      items: [
        "apply-groups",
        "description",
        "disable",
        "ether-options",
        "gigether-options",
        "mtu",
        "unit",
        "vlan-tagging",
      ].map((label) => ({ label, kind: vscode.CompletionItemKind.Text })),
    });
  });

  test("Completes defined prefix-list", async () => {
    await testCompletion(docUri, new vscode.Position(4, 67), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-prefix", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined policy-statement", async () => {
    await testCompletion(docUri, new vscode.Position(5, 41), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-statement", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined community", async () => {
    await testCompletion(docUri, new vscode.Position(6, 65), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-community", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined policy-statement in vrf-import", async () => {
    await testCompletion(docUri, new vscode.Position(186, 41), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-statement", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined community in l2circuit", async () => {
    await testCompletion(docUri, new vscode.Position(187, 73), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-community", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined as-path", async () => {
    await testCompletion(docUri, new vscode.Position(7, 63), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-as-path", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined as-path-group", async () => {
    await testCompletion(docUri, new vscode.Position(8, 69), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-as-path-group", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined firewall filter", async () => {
    await testCompletion(docUri, new vscode.Position(9, 56), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-filter", kind: vscode.CompletionItemKind.Text },
        { label: "precedence", kind: vscode.CompletionItemKind.Text },
        { label: "shared-name", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined nat pool", async () => {
    await testCompletion(docUri, new vscode.Position(10, 68), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-pool", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined interface-range", async () => {
    await testCompletion(docUri, new vscode.Position(11, 29), {
      items: [
        { label: "all", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-interface", kind: vscode.CompletionItemKind.Text },
        { label: "xe-0/0/0", kind: vscode.CompletionItemKind.Text },
        { label: "xe-0/0/0.0", kind: vscode.CompletionItemKind.Text },
        { label: "xe-0/0/1", kind: vscode.CompletionItemKind.Text },
        { label: "xe-0/0/1.0", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined policy-statement only in logical-systems", async () => {
    await testCompletion(docUri, new vscode.Position(12, 62), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-import", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined prefix-list only in logical-systems", async () => {
    await testCompletion(docUri, new vscode.Position(13, 85), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "bar-prefix", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined global address-name in nat", async () => {
    for (const [line, character] of [
      [14, 81],
      [15, 86],
    ]) {
      await testCompletion(docUri, new vscode.Position(line, character), {
        items: [
          { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
          { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
          { label: "foo-address", kind: vscode.CompletionItemKind.Text },
        ],
      });
    }

    for (const [line, character] of [
      [16, 86],
      [17, 91],
      [18, 51],
    ]) {
      await testCompletion(docUri, new vscode.Position(line, character), {
        items: [
          { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
          { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
          { label: "foo-address", kind: vscode.CompletionItemKind.Text },
        ],
      });
    }
  });

  test("Completes defined pool name in nat", async () => {
    // global address book
    for (const [line, character, pools] of [
      [19, 81, ["foo-pool", "persistent-nat"]],
      [20, 91, ["bar-pool"]],
    ] as const) {
      await testCompletion(docUri, new vscode.Position(line, character), {
        items: [
          { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
          { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
          ...pools.map((p: string) => ({ label: p, kind: vscode.CompletionItemKind.Text })),
          { label: "word", kind: vscode.CompletionItemKind.Value },
        ],
      });
    }
  });

  test("Completes defined address-name in address-book", async () => {
    // global address book
    for (const [line, character, address] of [
      [21, 79, "bar-address"],
      [22, 83, "bar-address-set"],
    ] as const) {
      await testCompletion(docUri, new vscode.Position(line, character), {
        items: [
          { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
          { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
          { label: address, kind: vscode.CompletionItemKind.Text },
        ],
      });
    }

    // zone-specific address book
    for (const [line, character, address] of [
      [23, 91, "bar-address"],
      [24, 95, "bar-address-set"],
    ] as const) {
      await testCompletion(docUri, new vscode.Position(line, character), {
        items: [
          { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
          { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
          { label: address, kind: vscode.CompletionItemKind.Text },
        ],
      });
    }
  });

  test("Completes defined address / address-set in security policies", async () => {
    for (const [line, character, address] of [
      [25, 86, "bar-address"],
      [26, 91, "baz-address"],
      [27, 96],
      [28, 99],
    ] as const) {
      await testCompletion(docUri, new vscode.Position(line, character), {
        items: [
          { label: "any", kind: vscode.CompletionItemKind.Text },
          { label: "any-ipv4", kind: vscode.CompletionItemKind.Text },
          { label: "any-ipv6", kind: vscode.CompletionItemKind.Text },
          { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
          { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
          ...(address ? [{ label: address, kind: vscode.CompletionItemKind.Text }] : []),
          ...(address ? [{ label: `${address}-set`, kind: vscode.CompletionItemKind.Text }] : []),
          { label: "foo-address", kind: vscode.CompletionItemKind.Text },
          { label: "foo-address-set", kind: vscode.CompletionItemKind.Text },
        ],
      });
    }
  });

  test("Completes defined application in security policies", async () => {
    await testCompletion(docUri, new vscode.Position(30, 91), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "junos-defaults", kind: vscode.CompletionItemKind.Text },
        { label: "tcp-app", kind: vscode.CompletionItemKind.Text },
        { label: "word", kind: vscode.CompletionItemKind.Value },
      ],
    });
  });

  suite("Completes groups section", async () => {
    test("name", async () => {
      await testCompletion(docUri, new vscode.Position(32, 11), {
        items: [{ label: "word", kind: vscode.CompletionItemKind.Value }],
      });
    });

    test("after name", async () => {
      await testCompletion(docUri, new vscode.Position(33, 15), {
        items: [...rootItems, { label: "when", kind: vscode.CompletionItemKind.Text }].toSorted((a, b) =>
          a.label.localeCompare(b.label),
        ),
      });
    });

    test("after when", async () => {
      await testCompletion(docUri, new vscode.Position(34, 33), {
        items: [
          { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
          { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        ],
      });
    });
  });
});

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: vscode.CompletionList,
) {
  await activate(docUri);

  // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
  const actualCompletionList = await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    docUri,
    position,
  );

  // The schema (checked-in XSD build or a local DDL build) decides which keywords exist, so keywords are
  // checked as "at least these"; names defined in the fixture must match exactly.
  const label = (item: vscode.CompletionItem) => (typeof item.label === "string" ? item.label : item.label.label);
  for (const expectedItem of expectedCompletionList.items) {
    const actualItem = actualCompletionList.items.find((i) => label(i) === label(expectedItem));
    assert.ok(actualItem, `"${label(expectedItem)}" missing`);
    assert.equal(actualItem.kind, expectedItem.kind, `kind of "${label(expectedItem)}"`);
  }
  const expectedLabels = new Set(expectedCompletionList.items.map((i) => label(i)));
  const unexpectedNames = actualCompletionList.items
    .map((i) => label(i))
    .filter((l) => !expectedLabels.has(l) && fixtureName.test(l));
  assert.deepEqual(unexpectedNames, []);
}

// Names defined in junos.conf, as opposed to schema keywords
const fixtureName = /^(?:foo|bar|baz)-|^xe-|^tcp-app$|^junos-defaults$/;
