import * as assert from "node:assert";

import * as vscode from "vscode";

import { activate, getDocUri } from "./helper";

const offset = 38; // lines for completion tests

suite("Should get diagnostics", () => {
  const docUri = getDocUri("junos.conf");

  test("Diagnoses syntax", async () => {
    await testDiagnostics(docUri, [
      {
        message: '"groups " is invalid',
        range: toRange(-6, 4, 11),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-filter_" is not defined',
        range: toRange(3, 56, 67),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"inet_" is invalid',
        range: toRange(4, 38, 43),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-statement_" is not defined',
        range: toRange(7, 41, 55),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"xe-0/0/0.1" is not defined',
        range: toRange(9, 29, 39),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"protocols" is invalid',
        range: toRange(11, 4, 13),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-prefix_" is not defined',
        range: toRange(18, 67, 78),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-community_" is not defined',
        range: toRange(20, 65, 79),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-as-path_" is not defined',
        range: toRange(22, 63, 75),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-as-path-group_" is not defined',
        range: toRange(24, 69, 87),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-pool_" is not defined',
        range: toRange(29, 68, 77),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-interface_" is not defined',
        range: toRange(33, 29, 43),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"bar-import" is not defined',
        range: toRange(38, 62, 72),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      ...(
        [
          [49, 81, 93, "foo-address_"],
          [51, 86, 98, "foo-address_"],
          [53, 86, 98, "foo-address_"],
          [55, 91, 103, "foo-address_"],
          [57, 51, 63, "foo-address_"],
          [61, 79, 90, "foo-address"],
          [63, 79, 91, "bar-address_"],
          [64, 83, 98, "foo-address-set"],
          [66, 83, 99, "bar-address-set_"],
        ] as Array<[number, number, number, string]>
      ).map(([line, sChar, eChar, address]) => ({
        message: `"${address}" is not defined`,
        range: toRange(line, sChar, eChar),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      })),

      // global address books
      ...(
        [
          [79, 93, 104, "baz-address"],
          [83, 98, 109, "bar-address"],
          [89, 96, 107, "bar-address"],
          [91, 96, 107, "baz-address"],
          [95, 99, 110, "bar-address"],
          [97, 99, 110, "baz-address"],
        ] as Array<[number, number, number, string]>
      ).flatMap(([line, sChar, eChar, address]) => [
        {
          message: `"${address}" is not defined`,
          range: toRange(line, sChar, eChar),
          severity: vscode.DiagnosticSeverity.Error,
          source: "ex",
        },
        {
          message: `"${address}-set" is not defined`,
          range: toRange(line + 1, sChar, eChar + 4),
          severity: vscode.DiagnosticSeverity.Error,
          source: "ex",
        },
      ]),

      // zone-specific address books
      ...(
        [
          [109, 97, 108, "baz-address"],
          [113, 102, 113, "bar-address"],
          [119, 97, 108, "bar-address"],
          [121, 97, 108, "baz-address"],
          [125, 102, 113, "bar-address"],
          [127, 102, 113, "baz-address"],
        ] as Array<[number, number, number, string]>
      ).flatMap(([line, sChar, eChar, address]) => [
        {
          message: `"${address}" is not defined`,
          range: toRange(line, sChar, eChar),
          severity: vscode.DiagnosticSeverity.Error,
          source: "ex",
        },
        {
          message: `"${address}-set" is not defined`,
          range: toRange(line + 1, sChar, eChar + 4),
          severity: vscode.DiagnosticSeverity.Error,
          source: "ex",
        },
      ]),
    ]);
  });
});

function toRange(line: number, sChar: number, eChar: number) {
  const start = new vscode.Position(line + offset, sChar);
  const end = new vscode.Position(line + offset, eChar);
  return new vscode.Range(start, end);
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
  await activate(docUri);

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

  for (const [i, expectedDiagnostic] of expectedDiagnostics.entries()) {
    const actualDiagnostic = actualDiagnostics[i];
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
  }
}
