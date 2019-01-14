'use strict';

import {
    CompletionItem,
    CompletionItemKind,
    RequestHandler,
    TextDocumentPositionParams,
} from 'vscode-languageserver';

import {prefixPattern} from './parser';
import {Session} from './session';


export function completion(session: Session): RequestHandler<TextDocumentPositionParams, CompletionItem[], void> {
    return (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        // The pass parameter contains the position of the text document in
        // which code complete got requested. For the example we ignore this
        // info and always provide the same completion items.
        const doc = session.documents.get(textDocumentPosition.textDocument.uri);
        let line = doc.getText().split("\n")[textDocumentPosition.position.line];

        if (!line.match(prefixPattern)) {
            return [];
        }

        line = line.replace(prefixPattern, '');
        const keywords = session.parser.keywords(line);

        // List interface definitions
        if (line.match(/\s+interface\s+$/)) {
            addInterfaceReferences(session, session.definitions['interface'], keywords);
        }

        return keywords.map((keyword, i) => ({
            label: keyword,
            kind: keyword === 'word' ? CompletionItemKind.Value : CompletionItemKind.Text,
            data: `${line} ${keyword}`
        }));
    };
}

function addInterfaceReferences(session: Session, definitions: Object, keywords) {
    const index = keywords.indexOf('word');
    if (index < 0) {
        return;
    }

    keywords.splice(index, 1);
    keywords.unshift(...Object.keys(definitions));
}

export function completionResolve(session: Session): RequestHandler<CompletionItem, CompletionItem, void> {
    return (item: CompletionItem): CompletionItem => {
        item.detail = session.parser.description(item.data);
        return item;
    }
}
