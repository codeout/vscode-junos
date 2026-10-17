import type { CompletionItem, TextDocumentPositionParams } from "vscode-languageserver";
import { CompletionItemKind } from "vscode-languageserver";

import type { Token } from "./config";
import { contextAt, pathWord, tokenizeLine } from "./config";
import { communityReference, policyStatementReference, prefixListReference } from "./definition";
import { prefixPattern } from "./parser";
import {
  applyGroupsReference,
  interfaceReference,
  ribGroupReference,
  routingInstanceReference,
  routingTableReference,
} from "./references";
import type { Session } from "./session";

export function completion(session: Session) {
  return async (textDocumentPosition: TextDocumentPositionParams) => {
    const uri = textDocumentPosition.textDocument.uri;
    const doc = session.documents.get(uri);
    if (!doc) {
      return [];
    }

    const text = doc.getText();
    let line = text.split("\n")[textDocumentPosition.position.line];
    if (prefixPattern.test(line)) {
      line = line.replace(prefixPattern, "");
      if (line.includes("[")) {
        line = toLine(tokenizeLine(line));
      }
    } else {
      // Curly-brace format: the enclosing hierarchy plus the statement typed so far.
      // At the top level of a "set" style file, keep completing "set" lines only.
      const context = contextAt(text, doc.offsetAt(textDocumentPosition.position));
      if (!context || (context.depth === 0 && setLinePattern.test(text))) {
        return [];
      }
      line = toLine(context.words);
    }

    const hidden = await completeHiddenStatements(session, uri);
    const keywords = session.parser.keywords(line, hidden);

    let m = line.match(/\s*logical-systems\s+(\S+)/);
    const logicalSystem = m?.[1] || "global";

    // List defined symbols
    const rules = [
      ["interface", /\s+interface\s+$/],
      ["interface", new RegExp(`\\s+${interfaceReference}\\s+$`), true],
      ["prefix-list", new RegExp(`\\s+${prefixListReference}\\s+$`)],
      ["policy-statement", new RegExp(`\\s+${policyStatementReference}\\s+$`)],
      ["group", new RegExp(`\\s+${applyGroupsReference}\\s+$`)],
      ["rib-group", new RegExp(`\\s+${ribGroupReference}\\s+$`), true],
      ["community", new RegExp(`\\s+${communityReference}\\s+$`)],
      ["as-path", /\s+from\s+as-path\s+$/],
      ["as-path-group", /\s+from\s+as-path-group\s+$/],
      ["firewall-filter", /\s+filter\s+(?:input|output|input-list|output-list)\s+$/],
      ["service-nat-pool", /\s+then\s+translated\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)\s+$/],
      ["application", /\s+match\s+application\s+$/, true],
      ["routing-instance", new RegExp(`\\s+${routingInstanceReference}\\s+$`), true],
      // a routing table of an instance
      [
        "routing-instance",
        new RegExp(`\\s+${routingTableReference}\\s+$`),
        true,
        (name: string) => [`${name}.inet.0`, `${name}.inet6.0`],
      ],
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
          return [
            ...[...addressBooks].flatMap((a) => [`address:global:${a}`, `address-set:global:${a}`]),
            "address:global:global",
            `address:${zone}:global`,
            "address-set:global:global",
            `address-set:${zone}:global`,
          ];
        },
        /\s+policies\s+from-zone\s+(\S+)\s+to-zone\s+(\S+)\s+.*\s+match\s+(source|destination)-address\s+$/,
      ],
    ] as Array<
      [
        string | ((arg: RegExpMatchArray) => string | string[]),
        RegExp,
        boolean,
        ((name: string) => string[]) | undefined,
      ]
    >;

    for (const [symbolType, pattern, keepWord, expand] of rules) {
      m = line.match(pattern);
      if (m) {
        let types = typeof symbolType === "function" ? symbolType(m) : symbolType;
        if (!Array.isArray(types)) {
          types = [types];
        }

        // a name may be defined under several of the types
        const names = [
          ...new Set(
            types.flatMap((type) =>
              // configuration groups are global
              Object.keys(session.definitions.getDefinitions(uri, type === "group" ? "global" : logicalSystem, type)),
            ),
          ),
        ];
        addReferences(expand ? names.flatMap((n) => expand(n)) : names, keywords, keepWord);

        break;
      }
    }

    return keywords.map((keyword) => {
      const item: CompletionItem = {
        label: keyword,
        kind: keyword === "word" ? CompletionItemKind.Value : CompletionItemKind.Text,
        data: `${line} ${keyword}`,
      };
      if (session.parser.node(item.data)?.hidden) {
        item.labelDetails = { description: "hidden" };
      }
      return item;
    });
  };
}

const setLinePattern = new RegExp(prefixPattern.source, "m");

// Words joined like a "set" line after the command, with a trailing space for the reference rules
function toLine(tokens: Token[]) {
  const words = tokens.filter((t) => !t.unclosed).map((t) => pathWord(t));
  return ` ${words.join(" ")} `;
}

// replace "word" in `keywords` array with the defined names
function addReferences(names: string[], keywords: string[], keepWord = false) {
  const index = keywords.indexOf("word");
  if (index === -1) {
    return;
  }

  if (!keepWord) {
    keywords.splice(index, 1);
  }

  keywords.unshift(...names);
}

export function completionResolve(session: Session) {
  return (item: CompletionItem) => {
    item.detail = session.parser.node(item.data)?.description;
    return item;
  };
}

/**
 * Setting junos.completion.hiddenStatements: offer statements the CLI hides (default true)
 */
async function completeHiddenStatements(session: Session, uri: string) {
  try {
    const value = await session.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "junos.completion.hiddenStatements",
    });
    return value !== false;
  } catch {
    return true; // a client without workspace/configuration
  }
}
