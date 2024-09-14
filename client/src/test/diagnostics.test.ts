import * as assert from "assert";
import * as vscode from "vscode";

import { activate, getDocUri } from "./helper";

const offset = 22; // lines for completion tests

suite("Should get diagnostics", () => {
  const docUri = getDocUri("junos.conf");

  test("Diagnoses syntax", async () => {
    await testDiagnostics(docUri, [
      {
        message: '"foo-filter_" is not defined',
        range: toRange(3, 56, 3, 67),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"inet_" is invalid',
        range: toRange(4, 38, 4, 43),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-statement_" is not defined',
        range: toRange(7, 41, 7, 55),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"xe-0/0/0.1" is not defined',
        range: toRange(9, 29, 9, 39),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"protocols" is invalid',
        range: toRange(11, 4, 11, 13),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-prefix_" is not defined',
        range: toRange(18, 67, 18, 78),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-community_" is not defined',
        range: toRange(20, 65, 20, 79),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-as-path_" is not defined',
        range: toRange(22, 63, 22, 75),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-as-path-group_" is not defined',
        range: toRange(24, 69, 24, 87),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-pool_" is not defined',
        range: toRange(29, 68, 29, 77),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-interface_" is not defined',
        range: toRange(33, 29, 33, 43),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"bar-import" is not defined',
        range: toRange(36, 62, 36, 72),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(46, 81, 46, 93),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(48, 86, 48, 98),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(50, 86, 50, 98),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(52, 91, 52, 103),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-address_" is not defined',
        range: toRange(54, 51, 54, 63),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
    ]);
  });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine + offset, sChar);
  const end = new vscode.Position(eLine + offset, eChar);
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
