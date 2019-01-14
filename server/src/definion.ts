'use strict';

import {
    Definition,
    Location,
    Range,
    RequestHandler,
    TextDocument,
    TextDocumentPositionParams,
} from 'vscode-languageserver';

import {prefixPattern} from './parser';
import {Session} from './session';


export function definition(session: Session): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return (textDocumentPosition: TextDocumentPositionParams): Definition => {
        const doc: TextDocument = session.documents.get(textDocumentPosition.textDocument.uri);
        const line = doc.getText().split("\n")[textDocumentPosition.position.line];

        const definition = getInterfaceDefinition(session, line, textDocumentPosition.position.character, session.definitions['interface']) ||
            getPrefixListDefinition(session, line, textDocumentPosition.position.character, session.definitions['prefix-list']) ||
            getPolicyStatementDefinition(session, line, textDocumentPosition.position.character, session.definitions['policy-statement']) ||
            getCommunityDefinition(session, line, textDocumentPosition.position.character, session.definitions['community']) ||
            getAsPathDefinition(session, line, textDocumentPosition.position.character, session.definitions['as-path']) ||
            getAsPathGroupDefinition(session, line, textDocumentPosition.position.character, session.definitions['as-path-group']) ||
            getFirewallFilterDefinition(session, line, textDocumentPosition.position.character, session.definitions['firewall-filter']) ||
            [];

        return definition.map(d => Location.create(textDocumentPosition.textDocument.uri, d));
    }
}

/**
 * Return string if it's defined, Or return undefined.
 *
 * @param session
 * @param line
 * @param position
 * @param pattern
 */
function getDefinedSymbol(session: Session, line: string, position: number, pattern: string): string | undefined {
    const m: RegExpMatchArray = line.match(`(${prefixPattern.source}(?:\\s+.*)?\\s+${pattern}\\s+)(\\S+)`);

    // Return nothing when the cursor doesn't point at the keyword
    if (!m || m[0].length < position || m[1].length > position) {
        return;
    } else {
        return m[2];
    }
}

function getInterfaceDefinition(session: Session, line: string, position: number, definitions: Object): Range[] | undefined{
    const symbol = getDefinedSymbol(session, line, position, 'interface');
    // Return Range[] when the cursor is pointing to the keyword, or return undefined to chain
    return symbol ? definitions[symbol] || [] : undefined;
}

function getPrefixListDefinition(session: Session, line: string, position: number, definitions: Object): Range[] | undefined{
    const symbol = getDefinedSymbol(session, line, position, 'from\\s+(?:source-|destination-)?prefix-list');
    // Return Range[] when the cursor is pointing to the keyword, or return undefined to chain
    return symbol ? definitions[symbol] || [] : undefined;
}

function getPolicyStatementDefinition(session: Session, line: string, position: number, definitions: Object): Range[] | undefined{
    const symbol = getDefinedSymbol(session, line, position, '(?:import|export)');
    // Return Range[] when the cursor is pointing to the keyword, or return undefined to chain
    return symbol ? definitions[symbol] || [] : undefined;
}

function getCommunityDefinition(session: Session, line: string, position: number, definitions: Object): Range[] | undefined{
    const symbol = getDefinedSymbol(session, line, position, '(?:from\\s+community|then\\s+community\\s+(?:add|delete|set))');
    // Return Range[] when the cursor is pointing to the keyword, or return undefined to chain
    return symbol ? definitions[symbol] || [] : undefined;
}

function getAsPathDefinition(session: Session, line: string, position: number, definitions: Object): Range[] | undefined{
    const symbol = getDefinedSymbol(session, line, position, 'from\\s+as-path');
    // Return Range[] when the cursor is pointing to the keyword, or return undefined to chain
    return symbol ? definitions[symbol] || [] : undefined;
}

function getAsPathGroupDefinition(session: Session, line: string, position: number, definitions: Object): Range[] | undefined{
    const symbol = getDefinedSymbol(session, line, position, 'from\\s+as-path-group');
    // Return Range[] when the cursor is pointing to the keyword, or return undefined to chain
    return symbol ? definitions[symbol] || [] : undefined;
}

function getFirewallFilterDefinition(session: Session, line: string, position: number, definitions: Object): Range[] | undefined{
    const symbol = getDefinedSymbol(session, line, position, 'filter\\s+(?:input|output|input-list|output-list)');
    // Return Range[] when the cursor is pointing to the keyword, or return undefined to chain
    return symbol ? definitions[symbol] || [] : undefined;
}


export function updateDefinitions(session: Session, textDocument: TextDocument): void {
    session.definitions['interface'] = interfaceDefinitions(session, textDocument);
    session.definitions['prefix-list'] = prefixListDefinitions(session, textDocument);
    session.definitions['policy-statement'] = policyStatementDefinitions(session, textDocument);
    session.definitions['community'] = communityDefinitions(session, textDocument);
    session.definitions['as-path'] = asPathDefinitions(session, textDocument);
    session.definitions['as-path-group'] = asPathGroupDefinitions(session, textDocument);
    session.definitions['firewall-filter'] = firewallFilterDefinitions(session, textDocument);
}

function findDefinitions(session: Session, textDocument: TextDocument, pattern: string, definitions: Object,
                         modifyFunction: (arg: RegExpExecArray) => string): void {
    const text = textDocument.getText();

    // FIXME: We should have implemented with named captures, but avoid them due to performance consideration
    const fullPattern = new RegExp(`(${prefixPattern.source}\\s+${pattern}`, 'gm');
    let m: RegExpExecArray | null;

    while (m = fullPattern.exec(text)) {
        const symbol = modifyFunction(m);
        definitions[symbol] = definitions[symbol] || [];
        definitions[symbol].push({
            start: textDocument.positionAt(m.index + m[1].length),
            end: textDocument.positionAt(m.index + m[0].length),
        });
    }
}

function interfaceDefinitions(session: Session, textDocument: TextDocument): Object {
    const definitions = {};
    findDefinitions(session, textDocument, 'interfaces\\s+)(\\S+)', definitions, m => m[2]);
    findDefinitions(session, textDocument, 'interfaces\\s+)(\\S+)\\s+unit\\s+([0-9]+)', definitions,
        m => `${m[2]}.${m[3]}`); // "xe-0/0/0 unit 0" is referred as "xe-0/0/0.0"
    return definitions;
}

function prefixListDefinitions(session: Session, textDocument: TextDocument): Object {
    const definitions = {};
    findDefinitions(session, textDocument, 'policy-options\\s+prefix-list\\s+)(\\S+)', definitions, m => m[2]);
    return definitions;
}

function policyStatementDefinitions(session: Session, textDocument: TextDocument): Object {
    const definitions = {};
    findDefinitions(session, textDocument, 'policy-options\\s+policy-statement\\s+)(\\S+)', definitions, m => m[2]);
    return definitions;
}

function communityDefinitions(session: Session, textDocument: TextDocument): Object {
    const definitions = {};
    findDefinitions(session, textDocument, 'policy-options\\s+community\\s+)(\\S+)', definitions, m => m[2]);
    return definitions;
}

function asPathDefinitions(session: Session, textDocument: TextDocument): Object {
    const definitions = {};
    findDefinitions(session, textDocument, 'policy-options\\s+as-path\\s+)(\\S+)', definitions, m => m[2]);
    return definitions;
}

function asPathGroupDefinitions(session: Session, textDocument: TextDocument): Object {
    const definitions = {};
    findDefinitions(session, textDocument, 'policy-options\\s+as-path-group\\s+)(\\S+)', definitions, m => m[2]);
    return definitions;
}

function firewallFilterDefinitions(session: Session, textDocument: TextDocument): Object {
    const definitions = {};
    findDefinitions(session, textDocument, 'firewall(?:\\s+family\\s+\\S+)?\\s+filter\\s+)(\\S+)', definitions, m => m[2]);
    return definitions;
}
