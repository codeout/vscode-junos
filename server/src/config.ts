import type { Parser } from "./parser";
import { prefixPattern } from "./parser";

/**
 * A word, a quoted string, or a bracket list "[ a b ]" (`group` holds its elements).
 * Offsets are positions in the source text.
 */
export type Token = {
  text: string;
  start: number;
  end: number;
  group?: Token[];
  unclosed?: boolean;
};

type LexToken = Token & { kind: "word" | "{" | "}" | ";" | "[" | "]" };

type LexResult = {
  tokens: LexToken[];
  // The scan ended inside a comment or a quoted string
  openAtEnd: boolean;
};

export type Statement = {
  context: Token[];
  words: Token[];
  block: boolean;
  modifiers?: string[]; // "inactive:", "protect:", ... in front of the statement
};

export type StructureError = {
  start: number;
  end: number;
  message: string;
};

export type BraceParse = {
  statements: Statement[];
  errors: StructureError[];
};

const delimiters = new Set(["{", "}", ";", "[", "]"]);

// Statement prefixes in "load merge/replace" files and in "show configuration" output
export const modifierPattern = /^(?:inactive|active|protect|unprotect|atomic|replace|delete|update):$/;

// Lines which are not configuration statements in a curly-brace file
const skipLinePatterns = [
  prefixPattern, // "set" style lines are handled separately
  /^\s*\[edit(?:\s[^\]]*)?\]\s*$/, // [edit interfaces]
  /^\s*\{[\w:-]+\}\s*$/, // {master:0}
  /^\s*[\w.-]+@[\w.-]+[#>%]/, // user@host# show configuration
];

function isSkipLine(line: string) {
  return skipLinePatterns.some((p) => p.test(line));
}

/**
 * Split Junos configuration text into words, quoted strings and the delimiters "{ } ; [ ]".
 * Comments ("/* *\/" and "#" at the start of a token) are dropped; "/* *\/" comments (annotations) are
 * collected in `annotations` when given. A quoted string keeps its quotes, and \" does not end it.
 */
export function lex(
  text: string,
  start = 0,
  end = text.length,
  skipLines = false,
  annotations?: { start: number; end: number; text: string }[],
): LexResult {
  const tokens: LexToken[] = [];
  let i = start;

  while (i < end) {
    if (skipLines && (i === 0 || text[i - 1] === "\n")) {
      const eol = lineEnd(text, i);
      if (isSkipLine(text.slice(i, eol))) {
        i = eol;
        continue;
      }
    }

    const c = text[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "#") {
      const eol = lineEnd(text, i);
      if (eol >= end) {
        return { tokens, openAtEnd: true };
      }
      i = eol;
    } else if (c === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      if (close === -1 || close + 2 > end) {
        return { tokens, openAtEnd: true };
      }
      annotations?.push({ start: i, end: close + 2, text: text.slice(i + 2, close).trim() });
      i = close + 2;
    } else if (c === '"') {
      let j = i + 1;
      while (j < end && text[j] !== '"') {
        j += text[j] === "\\" ? 2 : 1;
      }
      if (j >= end) {
        // Unterminated: stop at the end of the line so the rest of the file is still parsed
        const eol = Math.min(lineEnd(text, i), end);
        tokens.push({ kind: "word", text: text.slice(i, eol), start: i, end: eol });
        if (eol >= end) {
          return { tokens, openAtEnd: true };
        }
        i = eol;
        continue;
      }
      tokens.push({ kind: "word", text: text.slice(i, j + 1), start: i, end: j + 1 });
      i = j + 1;
    } else if (delimiters.has(c)) {
      tokens.push({ kind: c as LexToken["kind"], text: c, start: i, end: i + 1 });
      i++;
    } else {
      let j = i + 1;
      while (j < end && !/\s/.test(text[j]) && !delimiters.has(text[j])) {
        j++;
      }
      tokens.push({ kind: "word", text: text.slice(i, j), start: i, end: j });
      i = j;
    }
  }

  return { tokens, openAtEnd: false };
}

function lineEnd(text: string, i: number) {
  const eol = text.indexOf("\n", i);
  return eol === -1 ? text.length : eol;
}

/**
 * Fold "[ a b ]" into a single token. A group ends at "]", or unclosed at "{ } ;" or the end.
 * Stray "]" are kept as LexTokens.
 */
function groupBrackets(tokens: LexToken[]) {
  const result: LexToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== "[") {
      result.push(t);
      continue;
    }

    const group: Token[] = [];
    let j = i + 1;
    while (j < tokens.length && tokens[j].kind === "word") {
      group.push(tokens[j]);
      j++;
    }

    const closed = j < tokens.length && tokens[j].kind === "]";
    const last = closed ? tokens[j] : group.at(-1) || t;
    result.push({
      kind: "word",
      text: closed ? "[ " + group.map((g) => g.text).join(" ") + " ]" : "[ " + group.map((g) => g.text).join(" "),
      start: t.start,
      end: last.end,
      group,
      unclosed: !closed,
    });
    i = closed ? j : j - 1;
  }

  return result;
}

/**
 * Tokens of a single "set" style line, without the leading command
 */
export function tokenizeLine(line: string, offset = 0): Token[] {
  const { tokens } = lex(line);
  return groupBrackets(tokens)
    .filter((t) => t.kind === "word")
    .map(({ text, start, end, group, unclosed }) => ({
      text,
      start: start + offset,
      end: end + offset,
      group: group?.map((g) => ({ ...g, start: g.start + offset, end: g.end + offset })),
      unclosed,
    }));
}

/**
 * The word used to walk the schema. Quoted spaces are squashed, and a bracket list stands for its first element.
 */
export function pathWord(token: Token): string {
  let text = token.group ? token.group[0]?.text || "" : token.text;
  // Junos accepts any word quoted, keywords too: internal-value "disable"
  if (text.length > 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }
  return text.replaceAll(/\s/g, "_");
}

function invalidIn(token: Token, keywords: string[]) {
  if (keywords.includes("word")) {
    return;
  }

  if (token.group) {
    return token.group.find((g) => !keywords.includes(pathWord(g)));
  }

  return keywords.includes(pathWord(token)) ? undefined : token;
}

/**
 * Return the first token of the trailing invalid part, or undefined when the statement is valid.
 *
 * @param parser
 * @param tokens Statement tokens, from the top of the hierarchy
 * @param allowSingle Accept a single top-level keyword (eg: "interfaces {"), which is invalid as "set interfaces"
 */
export function findInvalidToken(parser: Parser, tokens: Token[], allowSingle = false): Token | undefined {
  const words = tokens.map((t) => pathWord(t));

  const check = (n: number): Token | undefined => {
    if (n === 0) {
      return;
    }
    if (n === 1 && !allowSingle) {
      return tokens[0];
    }

    const invalid = invalidIn(tokens[n - 1], parser.keywords(words.slice(0, n - 1).join(" ")));
    if (!invalid) {
      return;
    }

    return check(n - 1) ?? invalid;
  };

  return check(tokens.length);
}

/**
 * Parse the curly-brace part of a document into statements with their enclosing hierarchy.
 * "set" style lines are skipped.
 */
export function parseBraces(text: string): BraceParse {
  const tokens = groupBrackets(lex(text, 0, text.length, true).tokens);
  const statements: Statement[] = [];
  const errors: StructureError[] = [];
  const stack: { head: Token[]; open: Token }[] = [];
  let current: Token[] = [];
  let modifiers: string[] = [];

  const context = () => stack.flatMap((s) => s.head);
  const emit = (block: boolean) => {
    if (current.length > 0) {
      statements.push({ context: context(), words: current, block, ...(modifiers.length > 0 && { modifiers }) });
    }
    current = [];
    modifiers = [];
  };

  const unexpected = (t: LexToken) => {
    errors.push({ start: t.start, end: t.end, message: `Unexpected "${t.text}"` });
  };
  const handlers: Record<LexToken["kind"], (t: LexToken) => void> = {
    word: ({ text, start, end, group, unclosed }) => {
      if (current.length > 0 || group || !modifierPattern.test(text)) {
        current.push({ text, start, end, group, unclosed });
      } else {
        modifiers.push(text);
      }
    },
    ";": () => emit(false),
    "{": (t) => {
      const head = current;
      emit(true);
      stack.push({ head, open: t });
    },
    "}": (t) => {
      emit(false);
      if (stack.length === 0) {
        unexpected(t);
      } else {
        stack.pop();
      }
    },
    "[": unexpected,
    "]": unexpected,
  };

  for (const t of tokens) {
    handlers[t.kind](t);
  }

  for (const { open } of stack) {
    errors.push({ start: open.start, end: open.end, message: 'Missing "}"' });
  }

  return { statements, errors };
}

/**
 * The hierarchy and the statement words before `offset`, for completion in curly-brace format.
 * Returns undefined when `offset` is inside a comment or a quoted string.
 */
export function contextAt(text: string, offset: number) {
  const { tokens: raw, openAtEnd } = lex(text, 0, offset, true);
  if (openAtEnd) {
    return;
  }

  const tokens = groupBrackets(raw);
  const stack: Token[][] = [];
  let current: Token[] = [];

  const handlers: Record<LexToken["kind"], (t: LexToken) => void> = {
    word: (t) => {
      if (current.length > 0 || t.group || !modifierPattern.test(t.text)) {
        current.push(t);
      }
    },
    ";": () => {
      current = [];
    },
    "{": () => {
      stack.push(current);
      current = [];
    },
    "}": () => {
      stack.pop();
      current = [];
    },
    "[": () => {},
    "]": () => {},
  };

  for (const t of tokens) {
    handlers[t.kind](t);
  }

  // Drop the word being typed, and an open bracket list so that its values are completed
  const last = current.at(-1);
  if (last && (last.unclosed || (last.end === offset && !last.group))) {
    current = current.slice(0, -1);
  }

  return { depth: stack.length, words: [...stack.flat(), ...current] };
}

/**
 * Text which has every curly-brace statement appended as an equivalent "set" line, so that "set" based
 * rules (definitions, references) apply to both formats. Offsets in the appended part map back to the source.
 */
export class ConfigView {
  readonly text: string;
  readonly sourceLength: number;
  private readonly segments: { from: number; to: number; length: number }[] = [];

  constructor(source: string, statements: Statement[]) {
    this.sourceLength = source.length;

    let text = source;
    for (const { context, words } of statements) {
      text += "\nset";
      for (const token of [...context, ...words]) {
        text += " ";
        if (token.group) {
          text += this.add(text.length, token.start, "[");
          for (const g of token.group) {
            text += " ";
            text += this.add(text.length, g.start, g.text);
          }
          if (!token.unclosed) {
            text += " ";
            text += this.add(text.length, token.end - 1, "]");
          }
        } else {
          text += this.add(text.length, token.start, token.text);
        }
      }
    }

    this.text = text;
  }

  private add(from: number, to: number, piece: string) {
    this.segments.push({ from, to, length: piece.length });
    return piece;
  }

  isSource(offset: number) {
    return offset < this.sourceLength;
  }

  toSourceOffset(offset: number) {
    if (offset <= this.sourceLength || this.segments.length === 0) {
      return Math.min(offset, this.sourceLength);
    }

    // last segment starting at or before offset
    let lo = 0;
    let hi = this.segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.segments[mid].from <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    const s = this.segments[lo];
    return s.to + Math.max(0, Math.min(offset - s.from, s.length));
  }
}
