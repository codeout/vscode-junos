import type { TextDocument } from "vscode-languageserver-textdocument";

import { annotationsByStatement } from "./convert";
import type { Target } from "./references";
import { specialGroup } from "./references";
import type { Session } from "./session";
import type { ConfigNode } from "./tree";
import { childrenOf, configTree, flatten, nodeAt, valuesOf, wordsOf } from "./tree";

/*
 * What a hover says about a defined name (policy, interface, community, ...): its annotation, its
 * description, and a summary of what it configures. Statements a group gives it count too.
 */

const maxLines = 12;

const code = (s: string) => `\`${s.replaceAll("`", "'")}\``;

function list(lines: string[]) {
  const shown = lines.slice(0, maxLines).map((l) => `- ${l}`);
  if (lines.length > maxLines) {
    shown.push(`- … ${lines.length - maxLines} more`);
  }
  return shown.join("\n");
}

// The definition's node in the configuration, and its path
function definitionNode(tree: ConfigNode, type: string, name: string, logicalSystem: string) {
  const root = logicalSystem === "global" ? tree : nodeAt(tree, ["logical-systems", logicalSystem]);
  switch (type) {
    case "policy-statement":
    case "community":
    case "prefix-list":
    case "as-path":
    case "as-path-group": {
      return nodeAt(root, ["policy-options", type, name]);
    }
    case "routing-instance": {
      return nodeAt(root, ["routing-instances", name]);
    }
    case "rib-group": {
      return nodeAt(root, ["routing-options", "rib-groups", name]);
    }
    case "group": {
      return nodeAt(tree, ["groups", name]);
    }
    case "interface": {
      const m = name.match(/^(.+)\.(\d+)$/);
      return nodeAt(root, m ? ["interfaces", m[1], "unit", m[2]] : ["interfaces", name]);
    }
    case "firewall-filter": {
      const firewall = nodeAt(root, ["firewall"]);
      const families = childrenOf(firewall?.children.get("family"));
      return (
        nodeAt(firewall, ["filter", name]) ??
        families.map((f) => nodeAt(f, ["filter", name])).find((n) => n !== undefined)
      );
    }
    default: {
      return;
    }
  }
}

// "/* ... */" in front of the definition's statement (curly-brace format)
function annotationOf(session: Session, doc: TextDocument, target: Target, type: string) {
  const ranges = session.definitions.get(doc.uri, type, { logicalSystem: target.logicalSystem, symbol: target.name });
  if (!ranges?.length) {
    return;
  }
  const { braces } = session.analyze(doc);
  const annotations = annotationsByStatement(doc.getText());
  for (const range of ranges) {
    const start = doc.offsetAt(range.start);
    const statement = braces.statements.find((s) => s.words.some((w) => w.start === start));
    const annotation = statement && annotations.get(statement.words[0].start);
    if (annotation) {
      return annotation.join("\n");
    }
  }
}

// "(from group G)" when the statement is only there through a group
const origin = (node: ConfigNode | undefined) => (node?.inherited ? " _(from a group)_" : "");

function value(node: ConfigNode | undefined, label: string) {
  const values = valuesOf(node);
  return values.length > 0 ? `${label}: ${values.map((v) => code(v)).join(" ")}${origin(node)}` : undefined;
}

function policySummary(node: ConfigNode) {
  const lines: string[] = [];
  const terms = childrenOf(node.children.get("term"));
  for (const term of terms) {
    const from = term.children.get("from");
    const to = term.children.get("to");
    const then = term.children.get("then");
    const parts = [from && `from ${flatten(from)}`, to && `to ${flatten(to)}`, then && `→ ${flatten(then)}`].filter(
      Boolean,
    );
    lines.push(`term ${code(term.word)}${parts.length > 0 ? `: ${code(parts.join(" "))}` : ""}`);
  }
  for (const word of ["from", "to", "then"]) {
    const n = node.children.get(word);
    if (n) {
      lines.push(code(`${word} ${flatten(n)}`));
    }
  }
  return lines;
}

// the families of a unit, marked when a group gives them to a configured unit
function addresses(unit: ConfigNode) {
  const lines: string[] = [];
  for (const family of ["inet", "inet6", "iso", "mpls", "ethernet-switching"]) {
    const f = nodeAt(unit, ["family", family]);
    if (!f) {
      continue;
    }
    const address = wordsOf(f.children.get("address"));
    const from = unit.inherited ? "" : origin(f);
    lines.push(`family ${family}${address.length > 0 ? `: ${address.map((a) => code(a)).join(" ")}` : ""}${from}`);
  }
  return lines;
}

function unitSummary(unit: ConfigNode) {
  return [
    value(unit.children.get("vlan-id"), "vlan-id"),
    value(unit.children.get("vlan-id-list"), "vlan-id-list"),
    ...addresses(unit),
  ].filter((l): l is string => l !== undefined);
}

function interfaceSummary(node: ConfigNode, isUnit: boolean) {
  if (isUnit) {
    return unitSummary(node);
  }
  const lines = [
    value(node.children.get("mtu"), "mtu"),
    value(node.children.get("apply-groups"), "groups"),
    value(nodeAt(node, ["gigether-options", "802.3ad"]) ?? nodeAt(node, ["ether-options", "802.3ad"]), "802.3ad"),
  ].filter((l): l is string => l !== undefined);
  const units = childrenOf(node.children.get("unit"));
  for (const unit of units) {
    const description = valuesOf(unit.children.get("description"))[0];
    const details = [description && `"${description.replaceAll(/^"|"$/g, "")}"`, ...unitSummary(unit)].filter(Boolean);
    lines.push(`unit ${unit.word}${origin(unit)}${details.length > 0 ? `: ${details.join(", ")}` : ""}`);
  }
  return lines;
}

function instanceSummary(node: ConfigNode) {
  const lines = [
    value(node.children.get("instance-type"), "instance-type"),
    value(node.children.get("route-distinguisher"), "route-distinguisher"),
    value(node.children.get("vrf-target"), "vrf-target"),
    value(node.children.get("vrf-import"), "vrf-import"),
    value(node.children.get("vrf-export"), "vrf-export"),
  ].filter((l): l is string => l !== undefined);
  const interfaces = wordsOf(node.children.get("interface"));
  if (interfaces.length > 0) {
    lines.push(`interfaces: ${interfaces.map((i) => code(i)).join(" ")}`);
  }
  return lines;
}

function prefixListSummary(node: ConfigNode) {
  const lines = [value(node.children.get("apply-path"), "apply-path")].filter((l): l is string => l !== undefined);
  const prefixes = wordsOf(node).filter((k) => /^[\d.:a-f]+\/\d+$/i.test(k) || /^[\d.]+$/.test(k));
  return [...lines, ...prefixes.map((p) => code(p))];
}

function groupSummary(node: ConfigNode) {
  // the hierarchies the group configures, two levels deep: "interfaces <*>", "system"
  return childrenOf(node)
    .filter((c) => c.word !== "when")
    .map((c) => {
      const below = wordsOf(c).slice(0, 6);
      return code([c.word, ...below].join(" ") + (c.children.size > 6 ? " …" : ""));
    });
}

function summary(type: string, node: ConfigNode, name: string) {
  switch (type) {
    case "policy-statement": {
      return policySummary(node);
    }
    case "community": {
      return [value(node.children.get("members"), "members")].filter((l): l is string => l !== undefined);
    }
    case "prefix-list": {
      return prefixListSummary(node);
    }
    case "as-path": {
      return [value(node.children.get("path") ?? node, "path")].filter((l): l is string => l !== undefined);
    }
    case "interface": {
      return interfaceSummary(node, /\.\d+$/.test(name));
    }
    case "routing-instance": {
      return instanceSummary(node);
    }
    case "firewall-filter": {
      return childrenOf(node.children.get("term")).map((term) => {
        const then = term.children.get("then");
        return `term ${code(term.word)}${then ? `: ${code(`→ ${flatten(then)}`)}` : ""}`;
      });
    }
    case "group": {
      return groupSummary(node);
    }
    case "rib-group": {
      return [
        value(node.children.get("import-rib"), "import-rib"),
        value(node.children.get("export-rib"), "export-rib"),
        value(node.children.get("import-policy"), "import-policy"),
      ].filter((l): l is string => l !== undefined);
    }
    default: {
      return [];
    }
  }
}

/**
 * Markdown for a hover over a defined name, or undefined when there is nothing to say about it
 */
export function describe(session: Session, doc: TextDocument, target: Target): string | undefined {
  const tree = configTree(session, doc);
  for (const type of target.types) {
    const node = definitionNode(tree, type, target.name, target.logicalSystem);
    const special = type === "group" ? specialGroup(target.name) : undefined;
    if (!node && !special) {
      continue;
    }

    const kind = type === "interface" && /\.\d+$/.test(target.name) ? "unit" : type.split(":", 1)[0];
    const parts = [`**${kind}** ${code(target.name)}`];
    if (special) {
      parts.push(special);
    }
    if (node?.inherited) {
      parts.push("_Configured only through a group_");
    }
    const annotation = annotationOf(session, doc, target, type);
    if (annotation) {
      parts.push(
        annotation
          .split("\n")
          .map((l) => `_${l}_`)
          .join("  \n"),
      );
    }
    const description = valuesOf(node?.children.get("description"))[0];
    if (description) {
      parts.push(description.replaceAll(/^"|"$/g, ""));
    }
    const lines = node ? summary(type, node, target.name) : [];
    if (lines.length > 0) {
      parts.push(list(lines));
    }
    return parts.join("\n\n");
  }
}
