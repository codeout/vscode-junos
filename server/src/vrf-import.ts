import type { TextDocument } from "vscode-languageserver-textdocument";

import type { Token } from "./config";
import { tokenizeLine } from "./config";
import { prefixPattern } from "./parser";
import type { Session } from "./session";

/*
 * Community members may be UNIX-style regular expressions, except that VPN import policies (vrf-import)
 * do not support regular expressions for extended communities (target:, origin:, ...).
 * See "Understanding How to Define BGP Communities and Extended Communities" in the Junos documentation.
 */

export type Problem = { start: number; end: number; message: string };

type Word = { text: string; start: number; end: number };

// Characters that make a community member a regular expression. A "." only counts when it is not part of
// an IPv4 address (target:192.0.2.1:100 is a literal route target).
const regexChars = /[*+?^$[\]()|\\{}]|(?<!\d)\.|\.(?!\d)/;

export function isRegularExpression(member: string) {
  return regexChars.test(member);
}

// "type:administrator:assigned-number" of an extended community; large communities are not extended
export function isExtendedCommunity(member: string) {
  const m = member.replace(/^\^?\(*/, "").match(/^([a-z][a-z0-9-]*)[:|]/);
  return m !== null && m[1] !== "large";
}

function words(token: Token): Word[] {
  const list = token.group ?? [token];
  return list.map((t) => {
    const quoted = t.text.length > 1 && t.text.startsWith('"') && t.text.endsWith('"');
    return quoted ? { text: t.text.slice(1, -1), start: t.start + 1, end: t.end - 1 } : t;
  });
}

const key = (logicalSystem: string, name: string) => `${logicalSystem}\u{0}${name}`;

export function vrfImportProblems(session: Session, doc: TextDocument): Problem[] {
  const { view } = session.analyze(doc);
  const members = new Map<string, Map<number, Word>>(); // community -> members by source offset
  const policyCommunities = new Map<string, Map<string, Word[]>>(); // policy -> community -> uses
  const vrfImports = new Map<number, { policy: string; logicalSystem: string; word: Word }>();

  const pattern = new RegExp(`(${prefixPattern.source}[\\t ]+)(.*)`, "gm");
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(view.text))) {
    const lineStart = m.index + m[1].length;
    const tokens = tokenizeLine(m[2], lineStart).map((t) => ({
      ...t,
      start: view.toSourceOffset(t.start),
      end: view.toSourceOffset(t.end),
      group: t.group?.map((g) => ({ ...g, start: view.toSourceOffset(g.start), end: view.toSourceOffset(g.end) })),
    }));
    let logicalSystem = "global";
    let i = 0;
    if (tokens[0]?.text === "logical-systems" && tokens.length > 1) {
      logicalSystem = tokens[1].text;
      i = 2;
    }
    const at = (j: number) => tokens[i + j]?.text;

    // policy-options community NAME members [ ... ]
    if (at(0) === "policy-options" && at(1) === "community" && at(3) === "members" && tokens[i + 4]) {
      const k = key(logicalSystem, at(2)!);
      const list = members.get(k) ?? new Map<number, Word>();
      const listed = words(tokens[i + 4]);
      for (const w of listed) {
        list.set(w.start, w);
      }
      members.set(k, list);
    }

    // policy-options policy-statement NAME ... from community C
    if (at(0) === "policy-options" && at(1) === "policy-statement" && at(2)) {
      for (let j = i + 3; j + 2 < tokens.length; j++) {
        if (tokens[j].text !== "from" || tokens[j + 1].text !== "community") {
          continue;
        }

        const pk = key(logicalSystem, at(2)!);
        const uses = policyCommunities.get(pk) ?? new Map<string, Word[]>();
        const used = words(tokens[j + 2]);
        for (const w of used) {
          uses.set(w.text, [...(uses.get(w.text) ?? []), w]);
        }
        policyCommunities.set(pk, uses);
      }
    }

    // ... vrf-import P / vrf-import [ P1 P2 ]
    const v = tokens.findIndex((t) => t.text === "vrf-import");
    if (v === -1 || !tokens[v + 1]) {
      continue;
    }
    const policies = words(tokens[v + 1]);
    for (const w of policies) {
      vrfImports.set(w.start, { policy: w.text, logicalSystem, word: w });
    }
  }

  const problems: Problem[] = [];
  const reportedMembers = new Set<number>();
  for (const { policy, logicalSystem, word } of vrfImports.values()) {
    const uses = policyCommunities.get(key(logicalSystem, policy));
    if (!uses) {
      continue;
    }

    const offending: string[] = [];
    for (const community of uses.keys()) {
      const bad = [...(members.get(key(logicalSystem, community))?.values() ?? [])].filter(
        (w) => isExtendedCommunity(w.text) && isRegularExpression(w.text),
      );
      if (bad.length === 0) {
        continue;
      }
      offending.push(community);
      for (const w of bad) {
        if (reportedMembers.has(w.start)) {
          continue;
        }

        reportedMembers.add(w.start);
        problems.push({
          start: w.start,
          end: w.end,
          message: `"${w.text}" is a regular expression on an extended community, which vrf-import policies do not support (used by vrf-import ${policy})`,
        });
      }
    }

    if (offending.length > 0) {
      problems.push({
        start: word.start,
        end: word.end,
        message: `Policy "${policy}" matches extended communities by regular expression (${offending.join(", ")}), which vrf-import does not support`,
      });
    }
  }
  return problems;
}
