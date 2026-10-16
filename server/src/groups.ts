import type { Statement, Token } from "./config";
import { pathWord, tokenizeLine } from "./config";

/*
 * Configuration groups (Junos "Configuration Groups" in the CLI user guide):
 *
 * - "groups <name> <statements>" holds configuration in the shape of the top level hierarchy.
 * - "apply-groups [ <name> ... ]" at a hierarchy level makes that level and everything below it inherit the
 *   group's statements for that level. At the top level the whole group is inherited.
 * - In a group, a name in angle brackets is a wildcard ("<*>", "<et-*>", "<ge-0/0/[0-3]>"): it matches the
 *   objects already configured at that level and gives them its statements. It never creates an object.
 * - "apply-groups-except [ <name> ... ]" stops the inheritance of these groups at its level and below.
 *
 * The statements the configuration inherits are returned as statements of their own, so that the "set" line
 * rules (definitions) see them. Each word keeps the source position it comes from: the configured object for a
 * name matched by a wildcard, the group's statement otherwise.
 */

type Node = {
  token?: Token; // where the word is, for the first statement that has it
  children: Map<string, Node>;
  applyGroups: string[];
  exceptGroups: string[];
};

const newNode = (token?: Token): Node => ({ token, children: new Map(), applyGroups: [], exceptGroups: [] });

const applyKeywords = new Set(["apply-groups", "apply-groups-except"]);

/**
 * Add a statement (its words from the top of the hierarchy) to the tree
 */
function insert(root: Node, words: Token[]) {
  let node = root;
  for (const [i, token] of words.entries()) {
    const word = pathWord(token);
    if (applyKeywords.has(word)) {
      const names = (words[i + 1]?.group ?? (words[i + 1] ? [words[i + 1]] : [])).map((t) => pathWord(t));
      (word === "apply-groups" ? node.applyGroups : node.exceptGroups).push(...names);
      return;
    }

    let child = node.children.get(word);
    if (!child) {
      child = newNode(token);
      node.children.set(word, child);
    }
    node = child;
  }
}

/**
 * "<et-*>" -> a matcher for configured names, or undefined for a plain word
 */
function wildcard(word: string): RegExp | undefined {
  const m = word.match(/^<(.+)>$/);
  if (!m) {
    return;
  }

  let source = "";
  const pattern = m[1];
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    const close = pattern.indexOf("]", i + 1);
    if (c === "*") {
      source += ".*";
    } else if (c === "?") {
      source += ".";
    } else if (c === "[" && close !== -1) {
      // a character class; "!" first complements it
      let set = pattern.slice(i + 1, close);
      set = set.startsWith("!") ? `^${set.slice(1)}` : set;
      source += `[${set.replaceAll("\\", "\\\\").replaceAll("]", "\\]")}]`;
      i = close;
    } else {
      source += c.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

export type GroupInheritance = {
  statements: Statement[]; // inherited statements, as words from the top of the hierarchy
};

/**
 * The statements the configuration inherits from its groups.
 *
 * @param statements every "set" line and curly-brace statement, as words from the top of the hierarchy
 */
export function inheritGroups(statements: Token[][]): GroupInheritance {
  const config = newNode();
  const groups = new Map<string, Node>();
  for (const words of statements) {
    if (pathWord(words[0] ?? { text: "", start: 0, end: 0 }) !== "groups") {
      insert(config, words);
      continue;
    }
    const name = words[1] && pathWord(words[1]);
    if (!name) {
      continue;
    }
    let group = groups.get(name);
    if (!group) {
      group = newNode();
      groups.set(name, group);
    }
    insert(group, words.slice(2));
  }

  const inherited: Statement[] = [];
  const seen = new Set<string>();
  const emit = (words: Token[]) => {
    const key = words.map((t) => `${t.start}:${t.text}`).join(" ");
    if (!seen.has(key)) {
      seen.add(key);
      inherited.push({ context: [], words, block: false });
    }
  };

  // Give the configured `target` (at `path`) the statements of group node `from`
  const graft = (from: Node, target: Node | undefined, path: Token[], name: string) => {
    if (target?.exceptGroups.includes(name)) {
      return;
    }
    for (const [word, child] of from.children) {
      // "when" holds the group's conditions; groups do not apply groups
      if (word === "when" && path.length === 0) {
        continue;
      }

      const matcher = wildcard(word);
      if (matcher) {
        const configuredChildren = target?.children ?? new Map<string, Node>();
        for (const [configured, node] of configuredChildren) {
          if (matcher.test(configured)) {
            graft(child, node, [...path, node.token!], name);
          }
        }
        continue;
      }

      const words = [...path, child.token!];
      if (child.children.size === 0) {
        emit(words);
      }
      graft(child, target?.children.get(word), words, name);
    }
  };

  // Find the levels of the group that match `path` (wildcards included), then graft from there
  const apply = (from: Node, path: Token[], depth: number, target: Node, name: string) => {
    if (depth === path.length) {
      graft(from, target, path, name);
      return;
    }
    const word = pathWord(path[depth]);
    for (const [groupWord, child] of from.children) {
      if (groupWord === word || wildcard(groupWord)?.test(word)) {
        apply(child, path, depth + 1, target, name);
      }
    }
  };

  // Every level of the configuration with an apply-groups statement
  const visit = (node: Node, path: Token[]) => {
    for (const name of node.applyGroups) {
      const group = groups.get(name);
      if (group) {
        apply(group, path, 0, node, name);
      }
    }
    for (const child of node.children.values()) {
      visit(child, [...path, child.token!]);
    }
  };
  visit(config, []);

  return { statements: inherited };
}

/**
 * The statements of a document for inheritGroups: its "set" lines and curly-brace statements
 */
export function configuredStatements(text: string, braceStatements: Statement[]): Token[][] {
  const statements: Token[][] = braceStatements.map((s) => [...s.context, ...s.words]);
  const pattern = /^([\t ]*set[\t ]+)(.*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    statements.push(tokenizeLine(m[2], m.index + m[1].length));
  }
  return statements;
}
