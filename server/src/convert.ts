import type { Statement } from "./config";
import { prefixPattern } from "./parser";

/*
 * Curly-brace configuration -> "set" commands, as "show configuration | display set" prints them:
 * one "set" line per statement without sub-statements, then "deactivate" / "protect" / "delete" lines for
 * the statements marked "inactive:" / "protect:" / "delete:". "set" style lines of the document are kept.
 * Comments and annotations are dropped, as Junos drops them.
 */

const commandOf: Record<string, string> = {
  "inactive:": "deactivate",
  "protect:": "protect",
  "delete:": "delete",
};

export function toSetCommands(text: string, statements: Statement[]): string {
  const lines: { offset: number; text: string }[] = [];
  const marks: string[] = [];

  for (const [i, s] of statements.entries()) {
    const path = [...s.context, ...s.words].map((t) => t.text).join(" ");
    const modifiers = s.modifiers ?? [];
    for (const modifier of modifiers) {
      const command = commandOf[modifier];
      if (command) {
        marks.push(`${command} ${path}`);
      }
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

  return [...lines.toSorted((a, b) => a.offset - b.offset).map((l) => l.text), ...marks].join("\n") + "\n";
}
