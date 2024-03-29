import * as assert from "assert";
import * as vscode from "vscode";

import { activate, getDocUri } from "./helper";

suite("Should get diagnostics", () => {
  const docUri = getDocUri("junos.conf");

  test("Diagnoses syntax", async () => {
    await testDiagnostics(docUri, [
      {
        message: '"set interfaces xe-0/0/0 " is invalid',
        range: toRange(2, 0, 2, 24),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-filter_" is not defined',
        range: toRange(16, 56, 16, 67),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"inet_" is invalid',
        range: toRange(17, 38, 17, 43),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-statement_" is not defined',
        range: toRange(20, 41, 20, 55),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"xe-0/0/0.1" is not defined',
        range: toRange(22, 29, 22, 39),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"protocols" is invalid',
        range: toRange(24, 4, 24, 13),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-prefix_" is not defined',
        range: toRange(31, 67, 31, 78),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-community_" is not defined',
        range: toRange(33, 65, 33, 79),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-as-path_" is not defined',
        range: toRange(35, 63, 35, 75),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-as-path-group_" is not defined',
        range: toRange(37, 69, 37, 87),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo-pool_" is not defined',
        range: toRange(43, 68, 43, 77),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"foo_" is not defined',
        range: toRange(48, 29, 48, 33),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
      {
        message: '"bar-import" is not defined',
        range: toRange(51, 56, 51, 66),
        severity: vscode.DiagnosticSeverity.Error,
        source: "ex",
      },
    ]);
  });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine, sChar);
  const end = new vscode.Position(eLine, eChar);
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
