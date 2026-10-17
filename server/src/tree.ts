import type { TextDocument } from "vscode-languageserver-textdocument";

import type { Token } from "./config";
import { pathWord } from "./config";
import type { Session } from "./session";

/**
 * The configuration as a tree of words, from "set" lines, curly-brace statements and what groups give it.
 * A node is a word of a statement; a value is a node without children ("mtu" -> "9216").
 */
export type ConfigNode = {
  word: string; // pathWord of the token: quotes removed, a bracket list stands for its first element
  token?: Token; // the first statement's word
  inherited: boolean; // only from a configuration group
  children: Map<string, ConfigNode>;
};

const newNode = (word: string, inherited: boolean, token?: Token): ConfigNode => ({
  word,
  token,
  inherited,
  children: new Map(),
});

function insert(root: ConfigNode, words: Token[], inherited: boolean) {
  let node = root;
  for (const token of words) {
    const word = pathWord(token);
    let child = node.children.get(word);
    if (!child) {
      child = newNode(word, inherited, token);
      node.children.set(word, child);
    } else if (!inherited) {
      child.inherited = false;
    }
    node = child;
  }
}

const cache = new Map<string, { version: number; tree: ConfigNode }>();

export function configTree(session: Session, doc: TextDocument): ConfigNode {
  const cached = cache.get(doc.uri);
  if (cached?.version === doc.version) {
    return cached.tree;
  }

  const { configured, inheritedStatements } = session.analyze(doc);
  const tree = newNode("", false);
  for (const words of configured) {
    insert(tree, words, false);
  }
  for (const { words } of inheritedStatements) {
    insert(tree, words, true);
  }
  cache.set(doc.uri, { version: doc.version, tree });
  return tree;
}

export function forgetTree(uri: string) {
  cache.delete(uri);
}

/**
 * The children of a node, in the order they were configured
 */
export function childrenOf(node: ConfigNode | undefined): ConfigNode[] {
  const children: ConfigNode[] = [];
  if (node) {
    for (const child of node.children.values()) {
      children.push(child);
    }
  }
  return children;
}

/**
 * The words below a node: "interface" -> ["ge-0/0/0.0", "lo0.0"]
 */
export function wordsOf(node: ConfigNode | undefined): string[] {
  return childrenOf(node).map((c) => c.word);
}

/**
 * The node at `path` below `node`
 */
export function nodeAt(node: ConfigNode | undefined, path: string[]): ConfigNode | undefined {
  for (const word of path) {
    node = node?.children.get(word);
  }
  return node;
}

/**
 * The values of a statement: "members [ a b ]" -> ["a", "b"], "mtu 9216" -> ["9216"]
 */
export function valuesOf(node: ConfigNode | undefined): string[] {
  return childrenOf(node).flatMap((c) =>
    c.token?.group ? c.token.group.map((g) => g.text) : [c.token?.text ?? c.word],
  );
}

/**
 * The statements below `node` in one line: "community RT-INET; protocol bgp"
 */
export function flatten(node: ConfigNode, limit = 4): string {
  const statements: string[] = [];
  const walk = (n: ConfigNode, path: string[]) => {
    for (const c of n.children.values()) {
      const words = [...path, c.token?.text ?? c.word];
      if (c.children.size === 0) {
        statements.push(words.join(" "));
      } else {
        walk(c, words);
      }
    }
  };
  walk(node, []);
  const shown = statements.slice(0, limit).join("; ");
  return statements.length > limit ? `${shown}; …` : shown;
}
