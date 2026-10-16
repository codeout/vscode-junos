import type { TextDocument } from "vscode-languageserver-textdocument";

import { lex } from "./config";

/*
 * Junos annotates statements it does not apply in "show configuration" output:
 *
 *     ##
 *     ## Warning: statement ignored: unsupported platform (srx300)
 *     ##
 *     fxp0 {
 *         ...
 *     }
 */

export type JunosWarning = {
  message: string; // "statement ignored: unsupported platform (srx300)"
  block: { start: number; end: number }; // the "##" lines
  statement: { start: number; end: number }; // the first line of the statement
  extent: { start: number; end: number }; // the whole statement, up to its ";" or closing "}"
};

const commentLine = /^[\t ]*##.*$/gm;
// from the end of a "##" line: the first word of the next line that is not a "##" line
const nextStatement = /\s*\n[\t ]*(?!##)\S/y;

export function junosWarnings(doc: TextDocument): JunosWarning[] {
  const text = doc.getText();
  const warnings: JunosWarning[] = [];

  let m: RegExpExecArray | null;
  let blockStart = -1;
  let blockEnd = -1;
  let message: string | undefined;
  commentLine.lastIndex = 0;
  while ((m = commentLine.exec(text))) {
    // a run of "##" lines on consecutive lines
    if (blockStart === -1 || text.slice(blockEnd, m.index).trim() !== "") {
      blockStart = m.index;
      message = undefined;
    }
    blockEnd = m.index + m[0].length;
    message ??= m[0].match(/##\s*Warning:\s*(.*\S)/)?.[1];

    // the statement on the next line that is not a "##" line
    nextStatement.lastIndex = blockEnd;
    const next = nextStatement.exec(text);
    if (!message || !next) {
      continue;
    }

    const start = blockEnd + next[0].length - 1;
    const lineEnd = text.indexOf("\n", start);
    const head = { start, end: (lineEnd === -1 ? text.length : lineEnd) - (text[lineEnd - 1] === "\r" ? 1 : 0) };
    warnings.push({
      message,
      block: { start: blockStart, end: blockEnd },
      statement: head,
      extent: extentOf(text, start),
    });
    blockStart = -1;
  }
  return warnings;
}

// The statement starting at `start`: up to its ";", or its "{ ... }" block
function extentOf(text: string, start: number) {
  let depth = 0;
  for (const token of lex(text, start).tokens) {
    if (token.kind === "{") {
      depth++;
    } else if (token.kind === "}") {
      depth--;
      if (depth <= 0) {
        return { start, end: token.end };
      }
    } else if (token.kind === ";" && depth === 0) {
      return { start, end: token.end };
    }
  }
  return { start, end: text.length };
}
