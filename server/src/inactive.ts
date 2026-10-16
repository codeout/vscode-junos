import { lex, tokenizeLine } from "./config";
import { prefixPattern } from "./parser";

// the statement `words` is `path` or below it
function below(words: string[], path: string[]) {
  return path.every((w, i) => words[i] === w);
}

/**
 * Configuration Junos keeps but does not apply: "inactive:" statements of the curly-brace format, up to their
 * ";" or closing "}", and in "set" format the lines below a "deactivate" line's statement (and that line).
 */
export function inactiveRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];

  // curly-brace format
  const open: { start: number; depth: number }[] = [];
  let depth = 0;
  let statementStart = true;
  for (const token of lex(text, 0, text.length, true).tokens) {
    if (token.kind === "word") {
      if (statementStart && token.text === "inactive:") {
        open.push({ start: token.start, depth });
      }
      statementStart = false;
      continue;
    }

    if (token.kind === "{") {
      depth++;
    } else if (token.kind === "}") {
      depth--;
    }
    // a statement ends at ";" or at the "}" closing its block
    const ends = token.kind === ";" || token.kind === "}";
    while (ends && open.length > 0 && open.at(-1)!.depth === depth) {
      ranges.push({ start: open.pop()!.start, end: token.end });
    }
    if (token.kind !== "[" && token.kind !== "]") {
      statementStart = true;
    }
  }

  // "set" format
  const lines: { start: number; end: number; words: string[]; command: string }[] = [];
  const pattern = new RegExp(`(${prefixPattern.source})([\\t ]+)(.*)`, "gm");
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const start = m.index + m[1].length - m[1].trimStart().length;
    const words = tokenizeLine(m[3]).map((t) => t.text);
    lines.push({ start, end: m.index + m[0].trimEnd().length, words, command: m[1].trim() });
  }
  const deactivated = lines.filter((l) => l.command === "deactivate").map((l) => l.words);
  if (deactivated.length === 0) {
    return ranges;
  }
  for (const line of lines) {
    if ((line.command === "set" || line.command === "deactivate") && deactivated.some((p) => below(line.words, p))) {
      ranges.push({ start: line.start, end: line.end });
    }
  }
  return ranges;
}
