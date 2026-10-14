import type { Location, ReferenceParams } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { communityReference, policyStatementReference } from "./definition";
import { isIpPrefix } from "./ip";
import { prefixPattern } from "./parser";
import type { Session } from "./session";

/**
 * A use of a defined name, e.g. the "foo" of "from prefix-list foo". Offsets are in the source document.
 */
export type Reference = {
  start: number;
  end: number;
  name: string;
  logicalSystem: string;
  types: string[]; // symbol types (keys of session.definitions) the name may refer to
  allowed: boolean; // a keyword such as "all" or "any", not a reference
  denied: boolean; // never valid here
};

type SymbolType = string | ((m: RegExpMatchArray) => string | string[]);
type Rule = {
  type: SymbolType;
  pattern: string;
  allow?: string[] | ((m: RegExpMatchArray) => string[]);
  deny?: string[];
  // the referenced name inside the argument, or undefined when the argument refers to nothing
  symbol?: (arg: string) => { name: string; offset: number } | undefined;
};

/**
 * Statements that take a routing table name; a table "<instance>.<family>.<n>" refers to a routing-instance.
 * Tables of the master instance ("inet.0", "bgp.l3vpn.0") and internal ones ("__...") refer to nothing.
 */
export const routingTableReference = "(?:next-table|import-rib|export-rib)";

export function routingInstanceOfTable(table: string) {
  const m = table.match(/^(.+)\.[\w-]+\.\d+$/);
  if (!m || m[1] === "bgp" || m[1].startsWith("__")) {
    return;
  }
  return { name: m[1], offset: 0 };
}

function rules(session: Session, uri: string): Rule[] {
  return [
    { type: "interface", pattern: "interface", allow: ["all"], deny: ["interface-range"] },
    { type: "prefix-list", pattern: "from\\s+(?:source-|destination-)?prefix-list" },
    { type: "policy-statement", pattern: policyStatementReference },
    { type: "community", pattern: communityReference },
    { type: "as-path", pattern: "from\\s+as-path" },
    { type: "as-path-group", pattern: "from\\s+as-path-group" },
    { type: "firewall-filter", pattern: "filter\\s+(?:input|output|input-list|output-list)" },
    {
      type: "service-nat-pool",
      pattern: "then\\s+translated\\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)",
    },
    { type: "routing-instance", pattern: routingTableReference, symbol: routingInstanceOfTable },
    {
      type: "address:global:global",
      pattern: "nat\\s+.*\\s+match\\s+(?:source|destination)-address(?:-name)?",
      allow: (m) => (isIpPrefix(m[3]) ? [m[3]] : []),
    },
    { type: "address:global:global", pattern: "pool\\s+\\S+\\s+address-name" },

    // global address books
    {
      type: (m) => `address:global:${m[3]}`,
      pattern: "(?<=security\\s+)address-book\\s+(\\S+)\\s+address-set\\s+\\S+\\s+address",
    },
    {
      type: (m) => `address-set:global:${m[3]}`,
      pattern: "(?<=security\\s+)address-book\\s+(\\S+)\\s+address-set\\s+\\S+\\s+address-set",
    },

    // zone-specific address books
    {
      type: (m) => `address:${m[3]}:global`,
      pattern: "(?<=security\\s+)zones\\s+(\\S+)\\s+address-book\\s+address-set\\s+\\S+\\s+address",
    },
    {
      type: (m) => `address-set:${m[3]}:global`,
      pattern: "(?<=security\\s+)zones\\s+(\\S+)\\s+address-book\\s+address-set\\s+\\S+\\s+address-set",
    },

    {
      type: (m) => {
        const zone = m[5] === "source" ? m[3] : m[4];
        const addressBooks = session.zoneAddressBooks.get(uri, m.groups!.ls || "global", zone);
        return [
          ...[...addressBooks].flatMap((a) => [`address:global:${a}`, `address-set:global:${a}`]),
          "address:global:global",
          `address:${zone}:global`,
          "address-set:global:global",
          `address-set:${zone}:global`,
        ];
      },
      pattern: "from-zone\\s+(\\S+)\\s+to-zone\\s+(\\S+)\\s+.*\\s+match\\s+(source|destination)-address",
      allow: ["any", "any-ipv4", "any-ipv6"],
    },
  ];
}

const cache = new Map<string, { version: number; references: Reference[] }>();

export function forgetReferences(uri: string) {
  cache.delete(uri);
}

/**
 * All references in the document, in "set" lines and curly-brace statements.
 * Definitions (session.definitions) must be up to date: zone address books are read from there.
 */
export function collectReferences(session: Session, doc: TextDocument): Reference[] {
  const cached = cache.get(doc.uri);
  if (cached?.version === doc.version) {
    return cached.references;
  }

  const { view } = session.analyze(doc);
  const pattern = new RegExp(`(${prefixPattern.source}[\\t ]+)(.*)`, "gm");
  const references: Reference[] = [];
  const seen = new Set<string>();
  const ruleList = rules(session, doc.uri);
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(view.text))) {
    const lineStart = m.index + m[1].length;
    for (const rule of ruleList) {
      const matched = matchRule(m[2], rule);
      for (const ref of matched) {
        const start = view.toSourceOffset(lineStart + ref.start);
        const end = view.toSourceOffset(lineStart + ref.end);
        // a curly-brace statement is seen once per nested statement below it
        const key = `${start}:${end}:${ref.types.join(",")}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        references.push({ ...ref, start, end });
      }
    }
  }

  cache.set(doc.uri, { version: doc.version, references });
  return references;
}

/**
 * References of `rule` in a "set" line (without the command); offsets relative to `line`.
 */
function matchRule(line: string, rule: Rule): Reference[] {
  // Spaces inside quoted strings do not separate words (same length, so offsets stay valid)
  line = line.replaceAll(/"(?:[^"\\]|\\.)*"/g, (q) => q.replaceAll(/\s/g, "_"));
  const m = line.match(`^(?<stmt>(?:logical-systems\\s+(?<ls>\\S+))?.*\\s${rule.pattern}\\s+)(?<arg>\\S+)`);
  if (!m) {
    return [];
  }

  const allowList = typeof rule.allow === "function" ? rule.allow(m) : rule.allow;
  const typeOrTypes = typeof rule.type === "function" ? rule.type(m) : rule.type;
  const types = Array.isArray(typeOrTypes) ? typeOrTypes : [typeOrTypes];
  const logicalSystem = m.groups!.ls || "global";

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

  const out: Reference[] = [];
  for (const { arg: word, start: wordStart } of args) {
    // a quoted name refers to the name without quotes
    const quoted = word.length > 1 && word.startsWith('"') && word.endsWith('"');
    const arg = quoted ? word.slice(1, -1) : word;
    // dynamic-profile variables ($junos-interface-name, ...) are filled in at runtime
    if (arg.startsWith("$")) {
      continue;
    }
    const start = wordStart + (quoted ? 1 : 0);
    const symbol = rule.symbol ? rule.symbol(arg) : { name: arg, offset: 0 };
    if (!symbol) {
      continue;
    }
    out.push({
      start: start + symbol.offset,
      end: start + symbol.offset + symbol.name.length,
      name: symbol.name,
      logicalSystem,
      types,
      allowed: allowList?.includes(arg) ?? false,
      denied: rule.deny?.includes(arg) ?? false,
    });
  }
  return out;
}

export function isDefined(session: Session, uri: string, ref: Reference) {
  return ref.types.some((type) => ref.name in session.definitions.getDefinitions(uri, ref.logicalSystem, type));
}

export function referenceAt(session: Session, doc: TextDocument, offset: number) {
  return collectReferences(session, doc).find((r) => r.start <= offset && offset <= r.end);
}

/**
 * Definitions of the reference at `offset`, or undefined when there is no reference there.
 */
export function definitionsOfReferenceAt(session: Session, doc: TextDocument, offset: number) {
  const ref = referenceAt(session, doc, offset);
  if (!ref) {
    return;
  }

  return ref.types.flatMap(
    (type) => session.definitions.get(doc.uri, type, { logicalSystem: ref.logicalSystem, symbol: ref.name }) || [],
  );
}

export function references(session: Session) {
  return (params: ReferenceParams): Location[] => {
    const doc = session.documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const offset = doc.offsetAt(params.position);
    const refs = collectReferences(session, doc);

    // The symbol: a reference under the cursor, or a definition under the cursor
    let target: { name: string; logicalSystem: string; types: string[] } | undefined;
    const ref = refs.find((r) => r.start <= offset && offset <= r.end);
    if (ref) {
      const defined = ref.types.filter(
        (type) =>
          session.definitions.get(doc.uri, type, { logicalSystem: ref.logicalSystem, symbol: ref.name })?.length,
      );
      target = { name: ref.name, logicalSystem: ref.logicalSystem, types: defined.length > 0 ? defined : ref.types };
    } else {
      const def = session.definitions.at(doc.uri, params.position);
      if (def) {
        target = { name: def.symbol, logicalSystem: def.logicalSystem, types: [def.type] };
      }
    }
    if (!target) {
      return [];
    }

    const locations: Location[] = refs
      .filter(
        (r) =>
          r.name === target.name &&
          r.logicalSystem === target.logicalSystem &&
          r.types.some((t) => target.types.includes(t)),
      )
      .map((r) => ({ uri: doc.uri, range: { start: doc.positionAt(r.start), end: doc.positionAt(r.end) } }));

    if (params.context.includeDeclaration) {
      for (const type of target.types) {
        const ranges = session.definitions.get(doc.uri, type, {
          logicalSystem: target.logicalSystem,
          symbol: target.name,
        });
        locations.push(...(ranges || []).map((range) => ({ uri: doc.uri, range })));
      }
    }

    return locations;
  };
}
