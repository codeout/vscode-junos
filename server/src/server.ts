'use strict';

/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams
} from 'vscode-languageserver';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

connection.onInitialize((params: InitializeParams) => {
	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: [' ']
			}
		}
	};
});


import {schema} from '../src/junos';
import {Node, Parser} from './parser';

const ast = new Node('configuration', null, schema.configuration());
const parser = new Parser(ast);
const prefixPattern = /^[\t ]*(?:set|delete|activate|deactivate)/;
const maxNumberOfProblems = 1000;  // Just a guard


// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();
	let pattern = new RegExp(`(${prefixPattern.source}\\s+)(.*)`, 'gm');
	let m: RegExpExecArray | null;

	let problems = 0;
	let diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < maxNumberOfProblems) {
		problems++;

		let invalidPosition = validateLine(m[2]);
		if (typeof invalidPosition !== 'undefined') {
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

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

/**
 * Return null when validation is succeeded, or position where invalid statement starts
 *
 * @param line String to validate
 */
function validateLine(line: string): number | null {
	const match: string[] = squashQuotedSpaces(line).match(/(?:(.*)\s+)?(\S+)/);
	const keywords = parser.keywords(match[1]);

	if (keywords.includes('word') ||  // 'word' means wildcard
		keywords.includes(match[2])) {
		return;
	}

	// There is an invalid keyword in the beginning like "set foo"
	if (!match[1]) {
		return 0;
	}

	const short = validateLine(match[1]);
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

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		const doc = documents.get(_textDocumentPosition.textDocument.uri);
		let line = doc.getText().split("\n")[_textDocumentPosition.position.line].trim();

		if(!line.match(prefixPattern)) {
			return [];
		}

		line = line.replace(prefixPattern, '');
		const keywords = parser.keywords(line);

		return keywords.map((keyword, i) => ({
			label: keyword,
			kind: keyword === 'word' ? CompletionItemKind.Value : CompletionItemKind.Text,
			data: `${line} ${keyword}`
		}));
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		item.detail = parser.description(item.data);
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
