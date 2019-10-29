import * as vscode from 'vscode'
import * as assert from 'assert'
import {getDocUri, activate} from './helper'

describe('Should get diagnostics', () => {
    const docUri = getDocUri('junos.conf');

    it('Diagnoses syntax', async () => {
        await testDiagnostics(docUri, [
            {
                message: '"set interfaces xe-0/0/0 " is invalid',
                range: toRange(2, 0, 2, 24),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"foo-filter_" is not defined',
                range: toRange(14, 56, 14, 67),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"inet_" is invalid',
                range: toRange(15, 38, 15, 43),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"foo-statement_" is not defined',
                range: toRange(18, 41, 18, 55),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"xe-0/0/0.1" is not defined',
                range: toRange(20, 29, 20, 39),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"protocols" is invalid',
                range: toRange(22, 4, 22, 13),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"foo-prefix_" is not defined',
                range: toRange(29, 67, 29, 78),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"foo-community_" is not defined',
                range: toRange(31, 65, 31, 79),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"foo-as-path_" is not defined',
                range: toRange(33, 63, 33, 75),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"foo-as-path-group_" is not defined',
                range: toRange(35, 69, 35, 87),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
            {
                message: '"foo-pool_" is not defined',
                range: toRange(41, 68, 41, 77),
                severity: vscode.DiagnosticSeverity.Error,
                source: 'ex'
            },
        ])
    })
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
    const start = new vscode.Position(sLine, sChar);
    const end = new vscode.Position(eLine, eChar);
    return new vscode.Range(start, end)
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
    })
}
