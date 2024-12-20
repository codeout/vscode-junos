import { CompletionItem, CompletionItemKind, RequestHandler, TextDocumentPositionParams } from "vscode-languageserver";

import { prefixPattern } from "./parser";
import { Session } from "./session";

export function completion(session: Session): RequestHandler<TextDocumentPositionParams, CompletionItem[], void> {
  return (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const uri = textDocumentPosition.textDocument.uri;
    const doc = session.documents.get(uri);
    if (!doc) {
      return [];
    }

    let line = doc.getText().split("\n")[textDocumentPosition.position.line];
    if (!line.match(prefixPattern)) {
      return [];
    }

    line = line.replace(prefixPattern, "");
    const keywords = session.parser.keywords(line);

    let m = line.match(/\s*logical-systems\s+(\S+)/);
    const logicalSystem = m?.[1] || "global";

    // List defined symbols
    const rules = [
      ["interface", /\s+interface\s+$/],
      ["prefix-list", /\s+from\s+(?:source-|destination-)?prefix-list\s+$/],
      ["policy-statement", /\s+(?:import|export)\s+$/],
      ["community", /\s+(?:from\s+community|then\s+community\s+(?:add|delete|set))\s+$/],
      ["as-path", /\s+from\s+as-path\s+$/],
      ["as-path-group", /\s+from\s+as-path-group\s+$/],
      ["firewall-filter", /\s+filter\s+(?:input|output|input-list|output-list)\s+$/],
      ["nat-pool", /\s+then\s+translated\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)\s+$/],
      ["address:global", /\s+nat\s+.*\s+match\s+(?:source|destination)-address(?:-name)?\s+$/],
      ["address:global", /\s+pool\s+\S+\s+address-name\s+$/],
      [(m) => `address:${m[1]}`, /\s+address-book\s+(\S+)\s+address-set\s+\S+\s+address\s+$/],
      [(m) => `address-set:${m[1]}`, /\s+address-book\s+(\S+)\s+address-set\s+\S+\s+address-set\s+$/],
      [
        (m) => {
          const zone = m[3] === "source" ? m[1] : m[2];
          const addressBooks = session.zoneAddressBooks.get(uri, logicalSystem, zone);
          return [...addressBooks].map((a) => [`address:${a}`, `address-set:${a}`]).flat();
        },
        /\s+policies\s+from-zone\s+(\S+)\s+to-zone\s+(\S+)\s+.*\s+match\s+(source|destination)-address\s+$/,
      ],
    ] as Array<[string | ((arg: RegExpMatchArray) => string | string[]), RegExp]>;

    for (const [symbolType, pattern] of rules) {
      m = line.match(pattern);
      if (m) {
        let types = typeof symbolType === "function" ? symbolType(m) : symbolType;
        if (!Array.isArray(types)) {
          types = [types];
        }

        addReferences(
          Object.fromEntries(
            types.map((type) => Object.entries(session.definitions.getDefinitions(uri, logicalSystem, type))).flat(),
          ),
          keywords,
        );

        break;
      }
    }

    return keywords.map((keyword) => ({
      label: keyword,
      kind: keyword === "word" ? CompletionItemKind.Value : CompletionItemKind.Text,
      data: `${line} ${keyword}`,
    }));
  };
}

function addReferences(definitions: object, keywords: string[]) {
  const index = keywords.indexOf("word");
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
  };
}
