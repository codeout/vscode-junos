import type { SemanticTokens, SemanticTokensLegend, SemanticTokensParams } from "vscode-languageserver";
import { SemanticTokensBuilder } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

import type { Token } from "./config";
import { lex, modifierPattern, pathWord, tokenizeLine } from "./config";
import { prefixPattern } from "./parser";
import { collectReferences } from "./references";
import type { Session } from "./session";

/*
 * Semantic highlighting: every word is coloured by its role in the configuration, as the schema sees it.
 *
 *   macro       set / delete / activate / deactivate, inactive: / protect: / ...
 *   keyword     statements (system, interfaces, vrf-import, ...)
 *   enumMember  values from a fixed set (instance-type vrf, then accept, ...)
 *   variable    names you define (policies, communities, instances, terms, ...) and their uses;
 *               the definition has the "declaration" modifier
 *   interface   interface names, defined and used (xe-0/0/0, xe-0/0/0.0, ae0, ...)
 *               names of groups Junos applies by itself (re0, re1) also have the "defaultLibrary" modifier
 *   family      "family" and the address family of "family inet", "family inet6", ...
 *   number      numbers, addresses and prefixes
 *   string      other values
 *
 * Colours come from the user's theme. Comments and punctuation keep the TextMate grammar's colours.
 */
export const legend: SemanticTokensLegend = {
  tokenTypes: ["macro", "keyword", "enumMember", "variable", "number", "string", "interface", "family"],
  tokenModifiers: ["declaration", "defaultLibrary"],
};

const type = Object.fromEntries(legend.tokenTypes.map((t, i) => [t, i])) as Record<string, number>;
const DECLARATION = 1;
const DEFAULT_LIBRARY = 2;

// Groups Junos applies to the Routing Engine they are named after
const builtinGroups = new Set(["re0", "re1"]);
const groupModifier = (types: string[], name: string) =>
  types.includes("group") && builtinGroups.has(name) ? DEFAULT_LIBRARY : 0;

const numberPattern = /^-?\d+(?:\.\d+)?[kmgt]?$/i;
const ipv4Pattern = /^\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?$/;
// at least two colons: "65000:100" is a community or route distinguisher, not an address
const ipv6Pattern = /^(?=(?:[^:]*:){2})[\da-f:]+(?:\/\d{1,3})?$/i;

function isNumeric(word: string) {
  return numberPattern.test(word) || ipv4Pattern.test(word) || ipv6Pattern.test(word);
}

type Entry = { start: number; end: number; type: number; modifiers: number };

/**
 * Setting junos.highlighting: "semantic" (default) or "classic" (the TextMate grammar only)
 */
async function semanticEnabled(session: Session, uri: string) {
  try {
    const value = await session.connection.workspace.getConfiguration({ scopeUri: uri, section: "junos.highlighting" });
    return value !== "classic";
  } catch {
    return true;
  }
}

export function semanticTokens(session: Session) {
  return async (params: SemanticTokensParams): Promise<SemanticTokens> => {
    const doc = session.documents.get(params.textDocument.uri);
    if (!doc || !(await semanticEnabled(session, doc.uri))) {
      return { data: [] };
    }
    return encode(doc, classify(session, doc));
  };
}

function nameType(symbolTypes: string[]) {
  return symbolTypes.includes("interface") ? type.interface : type.variable;
}

export function classify(session: Session, doc: TextDocument): Entry[] {
  const text = doc.getText();
  const entries: Entry[] = [];

  // Names: definitions and references, by source range
  const names = new Map<number, Entry>();
  for (const { type: symbolType, range } of session.definitions.ranges(doc.uri)) {
    const start = doc.offsetAt(range.start);
    const end = doc.offsetAt(range.end);
    const name = text.slice(start, end);
    if (/\s/.test(name)) {
      continue;
    }
    const modifiers = DECLARATION | groupModifier([symbolType], name);
    names.set(start, { start, end, type: nameType([symbolType]), modifiers });
  }
  for (const ref of collectReferences(session, doc)) {
    if (names.has(ref.start) || ref.allowed) {
      continue;
    }

    const modifiers = groupModifier(ref.types, ref.name);
    names.set(ref.start, { start: ref.start, end: ref.end, type: nameType(ref.types), modifiers });
  }

  const word = (t: Token, path: string) => {
    const name = names.get(t.start) ?? names.get(t.start + 1); // a quoted name starts after the quote
    if (name) {
      entries.push(name);
      return;
    }
    const node = session.parser.node(path);
    if (!node) {
      return; // not in the schema: validation reports it
    }
    let tokenType: number;
    let modifiers = 0;
    if (node.type === "arg") {
      if (isNumeric(pathWord(t))) {
        tokenType = type.number;
      } else if (node.children.length > 0) {
        // the name of a list entry with statements of its own (term, group, file, ...)
        tokenType = type.variable;
        modifiers = DECLARATION;
      } else {
        tokenType = type.string;
      }
    } else if (
      pathWord(t) === "family" ||
      path.endsWith(` family ${pathWord(t)}`) ||
      path === `family ${pathWord(t)}`
    ) {
      tokenType = type.family;
    } else if (node.value && node.children.length === 0) {
      tokenType = type.enumMember;
    } else {
      tokenType = type.keyword;
    }
    entries.push({ start: t.start, end: t.end, type: tokenType, modifiers });
  };

  // Each statement's words, with the words before them as the schema path
  const statement = (context: Token[], words: Token[]) => {
    if (words.length === 0) {
      return;
    }
    // apply-groups [ <name> ... ] is not part of the schema
    const first = pathWord(words[0]);
    if (first === "apply-groups" || first === "apply-groups-except") {
      entries.push({ start: words[0].start, end: words[0].end, type: type.keyword, modifiers: 0 });
      const groupNames = words.slice(1).flatMap((w) => w.group ?? [w]);
      for (const n of groupNames) {
        const modifiers = groupModifier(["group"], pathWord(n));
        entries.push({ start: n.start, end: n.end, type: type.variable, modifiers });
      }
      return;
    }
    const path = context.map((t) => pathWord(t));
    for (const t of words) {
      const elements = t.group ?? [t];
      for (const element of elements) {
        word(element, [...path, pathWord(element)].join(" "));
      }
      path.push(pathWord(t));
    }
  };

  // "set" style lines
  const pattern = new RegExp(`(${prefixPattern.source})([\\t ]+)(.*)`, "gm");
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const command = m[1].trimStart();
    const commandStart = m.index + m[1].length - command.length;
    entries.push({ start: commandStart, end: commandStart + command.length, type: type.macro, modifiers: 0 });
    statement([], tokenizeLine(m[3], m.index + m[1].length + m[2].length));
  }

  // curly-brace statements
  const { braces } = session.analyze(doc);
  for (const s of braces.statements) {
    statement(s.context, s.words);
  }

  // inactive: / protect: / ... in front of a curly-brace statement
  const { tokens } = lex(text, 0, text.length, true);
  for (const [i, t] of tokens.entries()) {
    const previous = tokens[i - 1]?.kind;
    if (t.kind === "word" && modifierPattern.test(t.text) && (i === 0 || previous !== "word")) {
      entries.push({ start: t.start, end: t.end, type: type.macro, modifiers: 0 });
    }
  }

  return entries;
}

function encode(doc: TextDocument, entries: Entry[]): SemanticTokens {
  const text = doc.getText();
  const builder = new SemanticTokensBuilder();
  const seen = new Set<number>();
  let lastEnd = -1;
  const sorted = entries.toSorted((a, b) => a.start - b.start);
  for (const e of sorted) {
    // single-line, non-overlapping tokens only
    if (seen.has(e.start) || e.start < lastEnd || text.slice(e.start, e.end).includes("\n")) {
      continue;
    }
    seen.add(e.start);
    lastEnd = e.end;
    const position = doc.positionAt(e.start);
    builder.push(position.line, position.character, e.end - e.start, e.type, e.modifiers);
  }
  return builder.build();
}
