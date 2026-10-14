import type { Parser } from "./parser";

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

const delimiters = new Set(["{", "}", ";", "[", "]"]);

/**
 * Split Junos configuration text into words, quoted strings and the delimiters "{ } ; [ ]".
 * Comments ("/* *\/" and "#" at the start of a token) are dropped. A quoted string keeps its quotes,
 * and \" does not end it.
 */
export function lex(text: string, start = 0, end = text.length): LexResult {
  const tokens: LexToken[] = [];
  let i = start;

  while (i < end) {
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
  const text = token.group ? token.group[0]?.text || "" : token.text;
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
