import { Diagnostic, DiagnosticSeverity, TextDocument } from "vscode-languageserver";

import { prefixPattern } from "./parser";
import { Session } from "./session";

const maxNumberOfProblems = 1000; // Just a guard

export async function validateTextDocument(session: Session, textDocument: TextDocument): Promise<Diagnostic[]> {
  const text = textDocument.getText();
  const pattern = new RegExp(`(${prefixPattern.source}[\\t ]+)(.*)`, "gm");
  let m: RegExpExecArray | null;

  let problems = 0;
  const diagnostics: Diagnostic[] = [];
  while ((m = pattern.exec(text)) && problems < maxNumberOfProblems) {
    // Validate with AST based syntax
    const invalidPosition = validateLine(session, m[2]);
    if (typeof invalidPosition !== "undefined") {
      problems++;

      diagnostics.push(
        createDiagnostic(
          session,
          textDocument,
          m.index + m[1].length + invalidPosition,
          m.index + m[0].length,
          `"${m[2].slice(invalidPosition)}" is invalid`,
        ),
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
      ["nat-pool", "then\\s+translated\\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)"],
      ["address:global", "nat\\s+.*\\s+match\\s+(?:source|destination)-address(?:-name)?"],
      ["address:global", "pool\\s+\\S+\\s+address-name"],
      [(m) => `address:${m[3]}`, "address-book\\s+(\\S+)\\s+address-set\\s+\\S+\\s+address"],
      [(m) => `address-set:${m[3]}`, "address-book\\s+(\\S+)\\s+address-set\\s+\\S+\\s+address-set"],
      [
        (m) => {
          const zone = m[5] === "source" ? m[3] : m[4];
          const addressBooks = session.zoneAddressBooks.get(textDocument.uri, m.groups!.ls || "global", zone);
          return [...addressBooks].map((a) => [`address:${a}`, `address-set:${a}`]).flat();
        },
        "from-zone\\s+(\\S+)\\s+to-zone\\s+(\\S+)\\s+.*\\s+match\\s+(source|destination)-address",
      ],
    ] as Array<[string | ((arg: RegExpMatchArray) => string | string[]), string, string[], string[]]>;

    // Type guards ignored in closure. See https://github.com/microsoft/TypeScript/issues/38755
    rules.forEach(([symbolType, pattern, allowList, denyList]) => {
      const invalidRange = validateReference(
        session,
        match[2],
        textDocument.uri,
        symbolType,
        pattern,
        allowList,
        denyList,
      );
      if (typeof invalidRange !== "undefined") {
        problems++;

        diagnostics.push(
          createDiagnostic(
            session,
            textDocument,
            match.index + match[1].length + invalidRange[0],
            match.index + match[1].length + invalidRange[1],
            `"${match[2].slice(...invalidRange)}" is not defined`,
          ),
        );
      }
    });
  }

  return diagnostics;
}

function createDiagnostic(
  session: Session,
  textDocument: TextDocument,
  start: number,
  end: number,
  message: string,
): Diagnostic {
  return {
    severity: DiagnosticSeverity.Error,
    range: {
      start: textDocument.positionAt(start),
      end: textDocument.positionAt(end),
    },
    message: message,
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
  const m = squashQuotedSpaces(line).match(/(?:(.*)\s+)?(\S+)/);
  if (!m) {
    return;
  }

  // There is an invalid keyword in the beginning like "set foo"
  if (!m[1]) {
    return 0;
  }

  const keywords = session.parser.keywords(m[1]);

  if (
    keywords.includes("word") || // 'word' means wildcard
    keywords.includes(m[2])
  ) {
    return;
  }

  const shorter = validateLine(session, m[1]);
  return typeof shorter === "undefined" ? m[1].length + 1 : shorter;
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
  allowList?: string[],
  denyList?: string[],
): number[] | undefined {
  const m = line.match(`^(?<stmt>(?:logical-systems\\s+(?<ls>\\S+))?.*\\s${pattern}\\s+)(?<arg>\\S+)`);
  if (!m || allowList?.includes(m.groups!.arg)) {
    return;
  }

  const stmtLength = (m.index || 0) + m.groups!.stmt.length;
  const range = [stmtLength, stmtLength + m.groups!.arg.length];

  if (denyList?.includes(m.groups!.arg)) {
    return range;
  }

  let types = typeof symbolType === "function" ? symbolType(m) : symbolType;
  if (!Array.isArray(types)) {
    types = [types];
  }

  for (const type of types) {
    if (m.groups!.arg in session.definitions.getDefinitions(uri, m.groups!.ls || "global", type)) {
      return;
    }
  }

  return range;
}

/**
 * Replace quoted ' ' with '_' for easy tokenization
 *
 * @param string
 * @return string
 */
function squashQuotedSpaces(string: string): string {
  const pattern = /"[^"]*"/g;
  let match: RegExpExecArray | null;
  let cursor = 0;
  let buffer = "";

  while ((match = pattern.exec(string))) {
    buffer += string.slice(cursor, match.index);
    buffer += match[0].replace(/ /g, "_");
    cursor += match.index + match[0].length;
  }
  buffer += string.slice(cursor);

  return buffer;
}
