import type { Diagnostic, TextDocument } from "vscode-languageserver";
import { DiagnosticSeverity } from "vscode-languageserver";

import { findInvalidToken, tokenizeLine } from "./config";
import { isIpPrefix } from "./ip";
import { prefixPattern } from "./parser";
import type { Session } from "./session";

const maxNumberOfProblems = 1000; // Just a guard

export async function validateTextDocument(session: Session, textDocument: TextDocument) {
  const { braces, view } = session.analyze(textDocument);
  const text = view.text;
  const source = textDocument.getText();
  const pattern = new RegExp(`(${prefixPattern.source}[\\t ]+)(.*)`, "gm");
  let m: RegExpExecArray | null;

  let problems = 0;
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();
  const report = (start: number, end: number, message: string) => {
    const from = view.toSourceOffset(start);
    const to = view.toSourceOffset(end);
    const key = `${from}:${to}:${message}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    problems++;
    diagnostics.push(createDiagnostic(session, textDocument, from, to, message));
  };

  // Curly-brace structure and syntax
  for (const error of braces.errors) {
    if (problems >= maxNumberOfProblems) {
      break;
    }
    report(error.start, error.end, error.message);
  }
  for (const { context, words } of braces.statements) {
    if (problems >= maxNumberOfProblems) {
      break;
    }

    const invalid = findInvalidToken(session.parser, [...context, ...words], true);
    // An error in the enclosing hierarchy is reported at its own statement
    if (invalid === undefined || invalid.end <= words[0].start) {
      continue;
    }

    const end = words.at(-1)!.end;
    report(invalid.start, end, `"${source.slice(invalid.start, end)}" is invalid`);
  }

  while ((m = pattern.exec(text)) && problems < maxNumberOfProblems) {
    // Validate with AST based syntax. Appended lines from curly-brace statements are validated above.
    const invalidPosition = view.isSource(m.index) ? validateLine(session, m[2]) : undefined;
    if (invalidPosition !== undefined) {
      report(
        m.index + m[1].length + invalidPosition,
        m.index + m[0].length,
        `"${m[2].slice(invalidPosition)}" is invalid`,
      );
    }

    // Validate symbol reference
    const match = m;
    const rules = [
      ["interface", "interface", ["all"], ["interface-range"]],
      ["prefix-list", "from\\s+(?:source-|destination-)?prefix-list"],
      ["policy-statement", "(?:import|export)"],
      ["community", "(?:from\\s+community|then\\s+community\\s+(?:add|delete|set))"],
      ["as-path", "from\\s+as-path"],
      ["as-path-group", "from\\s+as-path-group"],
      ["firewall-filter", "filter\\s+(?:input|output|input-list|output-list)"],
      ["service-nat-pool", "then\\s+translated\\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)"],
      [
        "address:global:global",
        "nat\\s+.*\\s+match\\s+(?:source|destination)-address(?:-name)?",
        (m) => (isIpPrefix(m[3]) ? [m[3]] : []),
      ],
      ["address:global:global", "pool\\s+\\S+\\s+address-name"],

      // global address books
      [(m) => `address:global:${m[3]}`, "(?<=security\\s+)address-book\\s+(\\S+)\\s+address-set\\s+\\S+\\s+address"],
      [
        (m) => `address-set:global:${m[3]}`,
        "(?<=security\\s+)address-book\\s+(\\S+)\\s+address-set\\s+\\S+\\s+address-set",
      ],

      // zone-specific address books
      [
        (m) => `address:${m[3]}:global`,
        "(?<=security\\s+)zones\\s+(\\S+)\\s+address-book\\s+address-set\\s+\\S+\\s+address",
      ],
      [
        (m) => `address-set:${m[3]}:global`,
        "(?<=security\\s+)zones\\s+(\\S+)\\s+address-book\\s+address-set\\s+\\S+\\s+address-set",
      ],

      [
        (m) => {
          const zone = m[5] === "source" ? m[3] : m[4];
          const addressBooks = session.zoneAddressBooks.get(textDocument.uri, m.groups!.ls || "global", zone);
          return [
            ...[...addressBooks].flatMap((a) => [`address:global:${a}`, `address-set:global:${a}`]),
            "address:global:global",
            `address:${zone}:global`,
            "address-set:global:global",
            `address-set:${zone}:global`,
          ];
        },
        "from-zone\\s+(\\S+)\\s+to-zone\\s+(\\S+)\\s+.*\\s+match\\s+(source|destination)-address",
        ["any", "any-ipv4", "any-ipv6"],
      ],
    ] as Array<
      [
        string | ((arg: RegExpMatchArray) => string | string[]),
        string,
        string[] | ((arg: RegExpMatchArray) => string[]),
        string[],
      ]
    >;

    // Type guards ignored in closure. See https://github.com/microsoft/TypeScript/issues/38755
    for (const [symbolType, pattern, allowList, denyList] of rules) {
      const invalidRange = validateReference(
        session,
        match[2],
        textDocument.uri,
        symbolType,
        pattern,
        allowList,
        denyList,
      );
      if (invalidRange === undefined) {
        continue;
      }

      report(
        match.index + match[1].length + invalidRange[0],
        match.index + match[1].length + invalidRange[1],
        `"${match[2].slice(...invalidRange)}" is not defined`,
      );
    }
  }

  return diagnostics.toSorted(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character,
  );
}

function createDiagnostic(session: Session, textDocument: TextDocument, start: number, end: number, message: string) {
  return {
    severity: DiagnosticSeverity.Error,
    range: {
      start: textDocument.positionAt(start),
      end: textDocument.positionAt(end),
    },
    message,
  };
}

/**
 * Return undefined when validation is succeeded, or position where invalid statement starts
 *
 * @param session
 * @param line String to validate
 * @return number or undefined
 */
function validateLine(session: Session, line: string): number | undefined {
  return findInvalidToken(session.parser, tokenizeLine(line))?.start;
}

/**
 * Return undefined when validation is succeeded, or position range of invalid statement
 *
 * @param session
 * @param line String to validate
 * @param uri TextDocument's URI
 * @param symbolType string A key of session.definitions (eg: 'interface')
 * @param pattern string A line pattern to kick the validation
 * @param allowList string[] Keywords to pass the validation
 * @param denyList string[] Keywords to fail the validation
 * @return number[] or undefined [startPosition, endPosition]
 */
function validateReference(
  session: Session,
  line: string,
  uri: string,
  symbolType: string | ((arg: RegExpMatchArray) => string | string[]),
  pattern: string,
  allowList?: string[] | ((arg: RegExpMatchArray) => string[]),
  denyList?: string[],
) {
  const m = line.match(`^(?<stmt>(?:logical-systems\\s+(?<ls>\\S+))?.*\\s${pattern}\\s+)(?<arg>\\S+)`);
  if (!m) {
    return;
  }

  const list = typeof allowList === "function" ? allowList(m) : allowList;
  let types = typeof symbolType === "function" ? symbolType(m) : symbolType;
  if (!Array.isArray(types)) {
    types = [types];
  }
  const definitions = types.map((type) => session.definitions.getDefinitions(uri, m.groups!.ls || "global", type));

  const stmtLength = (m.index || 0) + m.groups!.stmt.length;
  let args = [{ arg: m.groups!.arg, start: stmtLength }];

  // A bracket list "[ a b ]" refers to each element
  if (m.groups!.arg === "[") {
    args = [];
    const elements = line.slice(stmtLength + 1).matchAll(/\S+/g);
    for (const e of elements) {
      if (e[0] === "]") {
        break;
      }
      args.push({ arg: e[0], start: stmtLength + 1 + e.index });
    }
  }

  for (const { arg, start } of args) {
    if (list?.includes(arg)) {
      continue;
    }

    const range = [start, start + arg.length];
    if (denyList?.includes(arg) || definitions.every((d) => !(arg in d))) {
      return range;
    }
  }
}
