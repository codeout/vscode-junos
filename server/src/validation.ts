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
        let invalidPosition = validateLine(session, m[2]);
        if (typeof invalidPosition !== 'undefined') {
            problems++;

            let diagnosic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: textDocument.positionAt(m.index + m[1].length + invalidPosition),
                    end: textDocument.positionAt(m.index + m[0].length)
                },
                message: `"${m[2].slice(invalidPosition)}" is invalid`
            };
            diagnostics.push(diagnosic);
        }
    }

    session.connection.sendDiagnostics({uri: textDocument.uri, diagnostics});
}

/**
 * Return null when validation is succeeded, or position where invalid statement starts
 *
 * @param session
 * @param line String to validate
 */
function validateLine(session: Session, line: string): number | null {
    const match: string[] = squashQuotedSpaces(line).match(/(?:(.*)\s+)?(\S+)/);
    const keywords = session.parser.keywords(match[1]);

    if (keywords.includes('word') ||  // 'word' means wildcard
        keywords.includes(match[2])) {
        return;
    }

    // There is an invalid keyword in the beginning like "set foo"
    if (!match[1]) {
        return 0;
    }

    const short = validateLine(session, match[1]);
    return typeof short === 'undefined' ? match[1].length + 1 : short;
}

/**
 * Replace quoted ' ' with '_' for easy tokenization
 *
 * @param string
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
