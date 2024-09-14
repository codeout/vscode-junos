import * as assert from "assert";
import * as vscode from "vscode";

import { activate, getDocUri } from "./helper";

const offset = 24; // lines for completion tests

suite("Should get diagnostics", () => {
  const docUri = getDocUri("junos.conf");

  test("Diagnoses syntax", async () => {
    await testDiagnostics(docUri, [
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
        range: toRange(36, 62, 72),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(47, 81, 93),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(49, 86, 98),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(51, 86, 98),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(53, 91, 103),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(55, 51, 63),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address" is not defined',
        range: toRange(58, 79, 90),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"bar-address_" is not defined',
        range: toRange(60, 79, 91),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address-set" is not defined',
        range: toRange(61, 83, 98),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"bar-address-set_" is not defined',
        range: toRange(63, 83, 99),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
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

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i];
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
  });
}
