'use strict';

import {
    Diagnostic,
    DiagnosticSeverity,
    TextDocument,
} from 'vscode-languageserver';

import {prefixPattern} from './parser';
import {Session} from './session';

const maxNumberOfProblems = 1000;  // Just a guard


export async function validateTextDocument(session: Session, textDocument: TextDocument): Promise<void> {
    let text = textDocument.getText();
    let pattern = new RegExp(`(${prefixPattern.source}\\s+)(.*)`, 'gm');
    let m: RegExpExecArray | null;

    let problems = 0;
    let diagnostics: Diagnostic[] = [];
    while ((m = pattern.exec(text)) && problems < maxNumberOfProblems) {
        // Validate with AST based syntax
        const invalidPosition = validateLine(session, m[2]);
        if (typeof invalidPosition !== 'undefined') {
            problems++;

            diagnostics.push(createDiagnostic(session, textDocument,
                m.index + m[1].length + invalidPosition,
                m.index + m[0].length,
                `"${m[2].slice(invalidPosition)}" is invalid`,
            ));
        }

        // Validate symbol reference
        [
            ['interface', 'interface'],
            ['prefix-list', 'from\\s+(?:source-|destination-)?prefix-list'],
            ['policy-statement', '(?:import|export)'],
            ['community', '(?:from\\s+community|then\\s+community\\s+(?:add|delete|set))'],
            ['as-path', 'from\\s+as-path'],
            ['as-path-group', 'from\\s+as-path-group'],
            ['firewall-filter', 'filter\\s+(?:input|output|input-list|output-list)']
        ].forEach(([symbolType, pattern]) => {
            const invalidRange = validateReference(session, m[2], textDocument.uri, symbolType, pattern);
            if (typeof invalidRange !== 'undefined') {
                problems++;

                diagnostics.push(createDiagnostic(session, textDocument,
                    m.index + m[1].length + invalidRange[0],
                    m.index + m[1].length + invalidRange[1],
                    `"${m[2].slice(...invalidRange)}" is not defined`,
                ));
            }
        });

    }

    session.connection.sendDiagnostics({uri: textDocument.uri, diagnostics});
}

function createDiagnostic(session: Session, textDocument: TextDocument, start: number, end: number, message: string): Diagnostic {
    return {
        severity: DiagnosticSeverity.Error,
        range: {
            start: textDocument.positionAt(start),
            end: textDocument.positionAt(end)
        },
        message: message,
    };
}

/**
 * Return undefined when validation is succeeded, or position where invalid statement starts
 *
 * @param session
 * @param line String to validate
 * @return number or undefined
 */
function validateLine(session: Session, line: string): number | undefined {
    const match: RegExpMatchArray = squashQuotedSpaces(line).match(/(?:(.*)\s+)?(\S+)/);
    if (!match) {
        return;
    }

    // There is an invalid keyword in the beginning like "set foo"
    if (!match[1]) {
        return 0;
    }

    const keywords = session.parser.keywords(match[1]);

    if (keywords.includes('word') ||  // 'word' means wildcard
        keywords.includes(match[2])) {
        return;
    }

    const shorter = validateLine(session, match[1]);
    return typeof shorter === 'undefined' ? match[1].length + 1 : shorter;
}

/**
 * Return undefined when validation is succeeded, or position range of invalid statement
 *
 * @param session
 * @param line String to validate
 * @param uri TextDocument's URI
 * @param symbolType string A key of session.definitions (eg: 'interface')
 * @param pattern string A line pattern to kick the validation
 * @return number[] or undefined [startPosition, endPosition]
 */
function validateReference(session: Session, line: string, uri: string, symbolType: string, pattern: string): number[] | undefined {
    const match: RegExpMatchArray = line.match(`(\\s${pattern}\\s+)(\\S+)`);
    if (!match) {
        return;
    }

    if (!(match[2] in session.definitions.getDefinitions(uri, symbolType))) {
        return [match.index + match[1].length, match.index + match[1].length + match[2].length];
    }
}

/**
 * Replace quoted ' ' with '_' for easy tokenization
 *
 * @param string
 * @return string
 */
function squashQuotedSpaces(string: string): string {
    const pattern = /"[^"]*"/g;
    let match: RegExpExecArray | null;
    let cursor = 0;
    let buffer = '';

    while (match = pattern.exec(string)) {
        buffer += string.slice(cursor, match.index);
        buffer += match[0].replace(/ /g, '_');
        cursor += match.index + match[0].length;
    }
    buffer += string.slice(cursor);

    return buffer;
}
