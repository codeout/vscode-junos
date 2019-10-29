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
        const uri = textDocumentPosition.textDocument.uri;
        const doc = session.documents.get(uri);
        let line = doc.getText().split("\n")[textDocumentPosition.position.line];

        if (!line.match(prefixPattern)) {
            return [];
        }

        line = line.replace(prefixPattern, '');
        const keywords = session.parser.keywords(line);

        // List defined symbols
        if (line.match(/\s+interface\s+$/)) {
            addReferences(session, session.definitions.getDefinitions(uri, 'interface'), keywords);
        } else if (line.match(/\s+from\s+(?:source-|destination-)?prefix-list\s+$/)) {
            addReferences(session, session.definitions.getDefinitions(uri, 'prefix-list'), keywords);
        } else if (line.match(/\s+(?:import|export)\s+$/)) {
            addReferences(session, session.definitions.getDefinitions(uri, 'policy-statement'), keywords);
        } else if (line.match(/\s+(?:from\s+community|then\s+community\s+(?:add|delete|set))\s+$/)) {
            addReferences(session, session.definitions.getDefinitions(uri, 'community'), keywords);
        } else if (line.match(/\s+from\s+as-path\s+$/)) {
            addReferences(session, session.definitions.getDefinitions(uri, 'as-path'), keywords);
        } else if (line.match(/\s+from\s+as-path-group\s+$/)) {
            addReferences(session, session.definitions.getDefinitions(uri, 'as-path-group'), keywords);
        } else if (line.match(/\s+filter\s+(?:input|output|input-list|output-list)\s+$/)) {
            addReferences(session, session.definitions.getDefinitions(uri, 'firewall-filter'), keywords);
        } else if (line.match(/\s+then\s+translated\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)\s+$/)) {
            addReferences(session, session.definitions.getDefinitions(uri, 'nat-pool'), keywords);
        }

        return keywords.map(keyword => ({
            label: keyword,
            kind: keyword === 'word' ? CompletionItemKind.Value : CompletionItemKind.Text,
            data: `${line} ${keyword}`
        }));
    };
}

function addReferences(session: Session, definitions: Object, keywords) {
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
