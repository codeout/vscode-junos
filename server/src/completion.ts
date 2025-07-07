import { CompletionItem, CompletionItemKind, TextDocumentPositionParams } from "vscode-languageserver";

import { prefixPattern } from "./parser";
import { Session } from "./session";

export function completion(session: Session) {
  return (textDocumentPosition: TextDocumentPositionParams) => {
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
      ["service-nat-pool", /\s+then\s+translated\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)\s+$/],
      [
        (m) => `security-nat-pool:${m[1]}`,
        /\s+security\s+nat\s+(?:source|destination)\s+.*\s+then\s+(source|destination)-nat\s+pool\s+$/,
        true,
      ],
      ["address:global:global", /\s+nat\s+.*\s+match\s+(?:source|destination)-address(?:-name)?\s+$/],
      ["address:global:global", /\s+pool\s+\S+\s+address-name\s+$/],

      // global address books
      [(m) => `address:global:${m[1]}`, /security\s+address-book\s+(\S+)\s+address-set\s+\S+\s+address\s+$/],
      [(m) => `address-set:global:${m[1]}`, /security\s+address-book\s+(\S+)\s+address-set\s+\S+\s+address-set\s+$/],

      // zone-specific address books
      [
        (m) => `address:${m[1]}:global`,
        /security\s+zones\s+security-zone\s+(\S+)\s+address-book\s+address-set\s+\S+\s+address\s+$/,
      ],
      [
        (m) => `address-set:${m[1]}:global`,
        /security\s+zones\s+security-zone\s+(\S+)\s+address-book\s+address-set\s+\S+\s+address-set\s+$/,
      ],

      [
        (m) => {
          const zone = m[3] === "source" ? m[1] : m[2];
          const addressBooks = session.zoneAddressBooks.get(uri, logicalSystem, zone);
          return [...addressBooks]
            .map((a) => [`address:global:${a}`, `address-set:global:${a}`])
            .flat()
            .concat([
              "address:global:global",
              `address:${zone}:global`,
              "address-set:global:global",
              `address-set:${zone}:global`,
            ]);
        },
        /\s+policies\s+from-zone\s+(\S+)\s+to-zone\s+(\S+)\s+.*\s+match\s+(source|destination)-address\s+$/,
      ],
    ] as Array<[string | ((arg: RegExpMatchArray) => string | string[]), RegExp, boolean]>;

    for (const [symbolType, pattern, keepWord] of rules) {
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
          keepWord,
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

// replace "word" in `keywords` array with all definitions keys
function addReferences(definitions: object, keywords: string[], keepWord = false) {
  const index = keywords.indexOf("word");
  if (index < 0) {
    return;
  }

  if (!keepWord) {
    keywords.splice(index, 1);
  }

  keywords.unshift(...Object.keys(definitions));
}

export function completionResolve(session: Session) {
  return (item: CompletionItem) => {
    item.detail = session.parser.description(item.data);
    return item;
  };
}
