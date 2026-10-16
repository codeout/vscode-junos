import type { Hover, HoverParams, Range } from "vscode-languageserver";
import { MarkupKind } from "vscode-languageserver";

import type { Token } from "./config";
import { pathWord, tokenizeLine } from "./config";
import { prefixPattern } from "./parser";
import { referenceAt, specialGroup } from "./references";
import type { Session } from "./session";

/**
 * Help text of the keyword (or of the value) under the cursor, from the Junos schema.
 */
export function hover(session: Session) {
  return (params: HoverParams): Hover | null => {
    const doc = session.documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    const offset = doc.offsetAt(params.position);

    // a group Junos applies by itself (re0, node0, member0, ...)
    const ref = referenceAt(session, doc, offset);
    const def = session.definitions.at(doc.uri, params.position);
    let group: { name: string; range: Range } | undefined;
    if (ref?.types.includes("group")) {
      group = { name: ref.name, range: { start: doc.positionAt(ref.start), end: doc.positionAt(ref.end) } };
    } else if (def?.type === "group") {
      group = { name: def.symbol, range: def.range };
    }
    const special = group && specialGroup(group.name);
    if (group && special) {
      return { contents: { kind: MarkupKind.Markdown, value: `**${group.name}** — ${special}` }, range: group.range };
    }
    const lineStart = doc.offsetAt({ line: params.position.line, character: 0 });
    const lineText = doc.getText().slice(lineStart).split("\n", 1)[0];

    // The statement under the cursor, from the top of the hierarchy
    let tokens: Token[];
    const prefix = lineText.match(prefixPattern);
    if (prefix) {
      tokens = tokenizeLine(lineText.slice(prefix[0].length), lineStart + prefix[0].length);
    } else {
      const inside = (t: Token) => t.start <= offset && offset <= t.end;
      const statement = session.analyze(doc).braces.statements.find((s) => s.words.some((t) => inside(t)));
      if (!statement) {
        return null;
      }
      tokens = [...statement.context, ...statement.words];
    }

    const index = tokens.findIndex((t) => t.start <= offset && offset <= t.end);
    if (index === -1) {
      return null;
    }
    // In a bracket list, the element under the cursor
    const token = tokens[index];
    const word = token.group?.find((g) => g.start <= offset && offset <= g.end) ?? token;
    const path = [...tokens.slice(0, index).map((t) => pathWord(t)), pathWord(word)].join(" ");

    const node = session.parser.node(path);
    if (!node) {
      return null;
    }

    let value: string;
    if (node.type === "arg") {
      // a value: say what it stands for, if the schema does
      if (!node.description) {
        return null;
      }
      value = node.description;
    } else {
      value = `**${node.name}**` + (node.description ? ` — ${node.description}` : "");
      if (node.hidden) {
        value += "\n\n_Hidden in the Junos CLI (internal, unsupported or deprecated)_";
      }
    }

    return {
      contents: { kind: MarkupKind.Markdown, value },
      range: { start: doc.positionAt(word.start), end: doc.positionAt(word.end) },
    };
  };
}
