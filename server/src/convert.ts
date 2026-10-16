import type { Statement, Token } from "./config";
import { lex, pathWord } from "./config";
import type { Parser } from "./parser";
import { prefixPattern } from "./parser";

/*
 * Curly-brace configuration -> "set" commands, as "show configuration | display set" prints them:
 * one "set" line per statement without sub-statements, then "deactivate" / "protect" / "delete" lines for
 * the statements marked "inactive:" / "protect:" / "delete:". "set" style lines of the document are kept.
 *
 * Annotations ("/* ... *\/" before a statement), which Junos leaves out of "display set", come last as
 * "annotate" commands at the statement's level ("edit <parent>", "annotate <statement> "...", "top"), so
 * that they can be cut off in one piece. "#" comments are dropped.
 */

const commandOf: Record<string, string> = {
  "inactive:": "deactivate",
  "protect:": "protect",
  "delete:": "delete",
};

type Annotation = { start: number; end: number; text: string };

/**
 * Annotations by the offset of the statement they are in front of (after "inactive:" and the like).
 * Annotations with only white space between them belong to the same statement.
 */
function annotationsByStatement(text: string) {
  const annotations: Annotation[] = [];
  lex(text, 0, text.length, true, annotations);

  const byStatement = new Map<number, string[]>();
  let pending: string[] = [];
  for (const [i, a] of annotations.entries()) {
    pending.push(
      a.text
        .split("\n")
        .map((l) => l.trim())
        .join("\n"),
    );
    const following = annotations[i + 1];
    if (following && text.slice(a.end, following.start).trim() === "") {
      continue;
    }

    const next = /(?:\s|[a-z]+:(?=\s))*/y;
    next.lastIndex = a.end;
    next.exec(text);
    byStatement.set(next.lastIndex, pending);
    pending = [];
  }
  return byStatement;
}

/**
 * The words "annotate" names a statement by at its level: a block's head ("unit 0", "ge-0/0/0"), a
 * leaf's keyword ("description"), with the name of a list entry ("address 10.0.0.1/24")
 */
function annotateTarget(parser: Parser, s: Statement) {
  if (s.block || s.words.length < 2) {
    return s.words;
  }
  const path = [...s.context, ...s.words.slice(0, 2)].map((t) => pathWord(t)).join(" ");
  const node = parser.node(path);
  return node?.type === "arg" && node.children.length > 0 ? s.words.slice(0, 2) : s.words.slice(0, 1);
}

const quote = (s: string) => `"${s.replaceAll("\\", "\\\\").replaceAll('"', String.raw`\"`)}"`;
const words = (tokens: Token[]) => tokens.map((t) => t.text).join(" ");

export function toSetCommands(text: string, statements: Statement[], parser: Parser): string {
  const lines: { offset: number; text: string }[] = [];
  const marks: string[] = [];
  const annotates: string[] = [];
  const annotations = annotationsByStatement(text);

  for (const [i, s] of statements.entries()) {
    const path = words([...s.context, ...s.words]);
    const modifiers = s.modifiers ?? [];
    for (const modifier of modifiers) {
      const command = commandOf[modifier];
      if (command) {
        marks.push(`${command} ${path}`);
      }
    }

    const annotation = annotations.get(s.words[0].start);
    if (annotation) {
      const command = `annotate ${words(annotateTarget(parser, s))} ${quote(annotation.join("\n"))}`;
      annotates.push(...(s.context.length > 0 ? [`edit ${words(s.context)}`, command, "top"] : [command]));
    }

    // a block with statements of its own is printed through them
    const next = statements[i + 1];
    const last = s.words.at(-1)!;
    if (s.block && next?.context.some((t) => t.start === last.start)) {
      continue;
    }
    lines.push({ offset: last.start, text: `set ${path}` });
  }

  // "set" style lines, where they are
  const pattern = new RegExp(`${prefixPattern.source}.*$`, "gm");
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    lines.push({ offset: m.index, text: m[0].trim() });
  }

  const sorted = lines.toSorted((a, b) => a.offset - b.offset).map((l) => l.text);
  // a blank line before the annotations, so that they are easy to cut off
  const tail = annotates.length > 0 ? ["", ...annotates] : [];
  return [...sorted, ...marks, ...tail].join("\n") + "\n";
}
