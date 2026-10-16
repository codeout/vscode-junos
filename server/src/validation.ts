import type { Diagnostic } from "vscode-languageserver";
import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

import type { Token } from "./config";
import { findInvalidToken, tokenizeLine } from "./config";
import { inactiveRanges } from "./inactive";
import { prefixPattern } from "./parser";
import { collectReferences, isDefined } from "./references";
import type { Session } from "./session";
import { vrfImportProblems } from "./vrf-import";
import { junosWarnings } from "./warnings";

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
  const reportSource = (from: number, to: number, message: string) => {
    const key = `${from}:${to}:${message}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    problems++;
    diagnostics.push(createDiagnostic(session, textDocument, from, to, message));
  };
  const report = (start: number, end: number, message: string) =>
    reportSource(view.toSourceOffset(start), view.toSourceOffset(end), message);

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

  // A unit number may be used once per interface
  const units = new Map<string, Token[][]>();
  for (const { context, words } of braces.statements) {
    const parent = context.map((t) => t.text);
    const isInterface =
      parent.at(-2) === "interfaces" || (parent.at(-3) === "interfaces" && parent.at(-2) === "interface-range");
    if (!isInterface || words[0]?.text !== "unit" || !words[1]) {
      continue;
    }
    const key = [...parent, "unit", words[1].text].join(" ");
    units.set(key, [...(units.get(key) ?? []), words.slice(0, 2)]);
  }
  for (const [key, occurrences] of units) {
    if (occurrences.length < 2) {
      continue;
    }
    const name = key.split(" ").at(-3);
    for (const [unit, id] of occurrences) {
      report(unit.start, id.end, `unit ${id.text} is defined more than once in ${name}`);
    }
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
  }

  // Symbol references
  for (const ref of collectReferences(session, textDocument)) {
    if (problems >= maxNumberOfProblems) {
      break;
    }
    if (!ref.allowed && (ref.denied || !isDefined(session, textDocument.uri, ref))) {
      reportSource(ref.start, ref.end, `"${ref.name}" is not defined`);
    }
  }

  for (const problem of vrfImportProblems(session, textDocument)) {
    reportSource(problem.start, problem.end, problem.message);
  }

  // "## Warning: ..." annotations of "show configuration"
  // from the start of the first "##" line, so every line is marked with its indentation
  for (const warning of junosWarnings(textDocument)) {
    diagnostics.push({
      ...createDiagnostic(session, textDocument, warning.block.start, warning.extent.end, warning.message),
      severity: DiagnosticSeverity.Warning,
      tags: [DiagnosticTag.Unnecessary],
      message: `Junos: ${warning.message}`,
    });
  }

  // inactive configuration: faded, not a problem
  for (const range of inactiveRanges(source)) {
    diagnostics.push({
      ...createDiagnostic(session, textDocument, range.start, range.end, "Inactive: Junos does not apply it"),
      severity: DiagnosticSeverity.Hint,
      tags: [DiagnosticTag.Unnecessary],
    });
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
