import type {
  Location,
  PrepareRenameParams,
  ReferenceParams,
  RenameParams,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";
import { ErrorCodes, ResponseError } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { communityReference, policyStatementReference, prefixListReference } from "./definition";
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
  // the statement also has sub-statements: an argument that is one of its keywords is no reference
  skipKeywords?: boolean;
  // the name is defined outside of logical systems
  global?: boolean;
};

/**
 * "apply-groups <name>" and "apply-groups-except <name>"
 */
export const applyGroupsReference = "apply-groups(?:-except)?";

// Groups that exist without being configured
export const builtinGroups = ["junos-defaults"];

/**
 * Statements that take a routing table name; a table "<instance>.<family>.<n>" refers to a routing-instance.
 * Tables of the master instance ("inet.0", "bgp.l3vpn.0") and internal ones ("__...") refer to nothing.
 */
export const routingTableReference = "(?:next-table|import-rib|export-rib)";

/**
 * "routing-instance <name>" (syslog host, ntp server, firewall then, ...). Not after "logical-system <ls>",
 * where the instance belongs to that logical system, and not the routing-instances hierarchy itself.
 */
export const routingInstanceReference = "(?<!logical-system\\s+\\S+\\s+)routing-instance";

// Instances that exist without being configured
export const builtinRoutingInstances = ["default", "master", "mgmt_junos"];

function routingInstanceName(name: string) {
  return name.startsWith("__") ? undefined : { name, offset: 0 };
}

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
    // some services take prefixes there ("from source-prefix-list 10.0.0.0/8")
    {
      type: "prefix-list",
      pattern: prefixListReference,
      allow: (m) => (isIpPrefix(m.groups!.arg) ? [m.groups!.arg] : []),
    },
    { type: "policy-statement", pattern: policyStatementReference },
    { type: "group", pattern: applyGroupsReference, allow: builtinGroups, global: true },
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
      type: "routing-instance",
      pattern: routingInstanceReference,
      allow: builtinRoutingInstances,
      symbol: routingInstanceName,
      skipKeywords: true,
    },
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
      const matched = matchRule(session, m[2], rule);
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
function matchRule(session: Session, line: string, rule: Rule): Reference[] {
  // Spaces inside quoted strings do not separate words (same length, so offsets stay valid)
  line = line.replaceAll(/"(?:[^"\\]|\\.)*"/g, (q) => q.replaceAll(/\s/g, "_"));
  const m = line.match(`^(?<stmt>(?:logical-systems\\s+(?<ls>\\S+)\\s+)?(?:.*\\s)?${rule.pattern}\\s+)(?<arg>\\S+)`);
  if (!m) {
    return [];
  }
  if (rule.skipKeywords && session.parser.keywords(m.groups!.stmt).includes(m.groups!.arg)) {
    return [];
  }

  const allowList = typeof rule.allow === "function" ? rule.allow(m) : rule.allow;
  const typeOrTypes = typeof rule.type === "function" ? rule.type(m) : rule.type;
  const types = Array.isArray(typeOrTypes) ? typeOrTypes : [typeOrTypes];
  const logicalSystem = (!rule.global && m.groups!.ls) || "global";

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

type Target = { name: string; logicalSystem: string; types: string[]; range: { start: number; end: number } };

/**
 * The symbol under the cursor: a reference, or a definition.
 */
function targetAt(session: Session, doc: TextDocument, offset: number): Target | undefined {
  const ref = referenceAt(session, doc, offset);
  if (ref) {
    const defined = ref.types.filter(
      (type) => session.definitions.get(doc.uri, type, { logicalSystem: ref.logicalSystem, symbol: ref.name })?.length,
    );
    return {
      name: ref.name,
      logicalSystem: ref.logicalSystem,
      types: defined.length > 0 ? defined : ref.types,
      range: { start: ref.start, end: ref.end },
    };
  }

  const def = session.definitions.at(doc.uri, doc.positionAt(offset));
  if (def) {
    return {
      name: def.symbol,
      logicalSystem: def.logicalSystem,
      types: [def.type],
      range: { start: doc.offsetAt(def.range.start), end: doc.offsetAt(def.range.end) },
    };
  }
}

function referencesOf(session: Session, doc: TextDocument, target: Target) {
  return collectReferences(session, doc).filter(
    (r) =>
      r.name === target.name &&
      r.logicalSystem === target.logicalSystem &&
      r.types.some((t) => target.types.includes(t)),
  );
}

function definitionsOf(session: Session, doc: TextDocument, target: Target) {
  return target.types.flatMap(
    (type) =>
      session.definitions.get(doc.uri, type, { logicalSystem: target.logicalSystem, symbol: target.name }) || [],
  );
}

export function references(session: Session) {
  return (params: ReferenceParams): Location[] => {
    const doc = session.documents.get(params.textDocument.uri);
    const target = doc && targetAt(session, doc, doc.offsetAt(params.position));
    if (!doc || !target) {
      return [];
    }

    const locations: Location[] = referencesOf(session, doc, target).map((r) => ({
      uri: doc.uri,
      range: { start: doc.positionAt(r.start), end: doc.positionAt(r.end) },
    }));
    if (params.context.includeDeclaration) {
      locations.push(...definitionsOf(session, doc, target).map((range) => ({ uri: doc.uri, range })));
    }
    return locations;
  };
}

// An interface definition covers "xe-0/0/0 unit 0" while references say "xe-0/0/0.0": not renamed here
const notRenamed = new Set(["interface"]);

// A name Junos would print without quotes (see needs_quotes in report 09): only those can replace a name as-is
const plainName = /^[^\s!"#$%&'();?@[\\\]^`{|}~]+$/;

/**
 * Ranges holding the target's name: its definitions and references. Ranges whose text is not the name
 * (such as the interface-unit definition "xe-0/0/0 unit 0") are left out.
 */
function renameRanges(session: Session, doc: TextDocument, target: Target) {
  const text = doc.getText();
  const ranges = [
    ...definitionsOf(session, doc, target).map((r) => ({ start: doc.offsetAt(r.start), end: doc.offsetAt(r.end) })),
    ...referencesOf(session, doc, target),
  ].filter((r) => text.slice(r.start, r.end) === target.name);

  const seen = new Set<string>();
  return ranges.filter((r) => {
    const key = `${r.start}:${r.end}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function renameTarget(session: Session, doc: TextDocument, offset: number) {
  const target = targetAt(session, doc, offset);
  if (!target || target.types.some((t) => notRenamed.has(t))) {
    return;
  }
  return target;
}

export function prepareRename(session: Session) {
  return (params: PrepareRenameParams) => {
    const doc = session.documents.get(params.textDocument.uri);
    const target = doc && renameTarget(session, doc, doc.offsetAt(params.position));
    if (!doc || !target) {
      return null;
    }
    return {
      range: { start: doc.positionAt(target.range.start), end: doc.positionAt(target.range.end) },
      placeholder: target.name,
    };
  };
}

export function rename(session: Session) {
  return (params: RenameParams): WorkspaceEdit | null => {
    const doc = session.documents.get(params.textDocument.uri);
    const target = doc && renameTarget(session, doc, doc.offsetAt(params.position));
    if (!doc || !target) {
      return null;
    }
    if (!plainName.test(params.newName)) {
      throw new ResponseError(ErrorCodes.InvalidParams, `"${params.newName}" is not a valid name`);
    }

    const edits: TextEdit[] = renameRanges(session, doc, target).map((r) => ({
      range: { start: doc.positionAt(r.start), end: doc.positionAt(r.end) },
      newText: params.newName,
    }));
    return { changes: { [doc.uri]: edits } };
  };
}
