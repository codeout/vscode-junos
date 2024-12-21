import { Enumeration, JunosSchema, Repeatable, SchemaObject, Sequence } from "../src/junos"; // './junos' breaks debugging on vscode

export const prefixPattern = /^[\t ]*(?:set|delete|activate|deactivate)/;

export class Node {
  name: string;
  parent: Node | null;
  children: Node[] = [];
  description?: string; // Can be undefined according to CompletionItem.detail
  type: string | null = null;
  repeatable? = false;

  constructor(
    name: string,
    parent: Node | null,
    rawChildren: SchemaObject | null,
    description?: string,
    type?: string,
  ) {
    this.name = name;
    this.parent = parent;
    this.description = description;
    this.type = type || null;

    if (rawChildren !== null) {
      this.load(rawChildren);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  load(rawChildren: string[] | Enumeration | Repeatable | Sequence | SchemaObject | Function) {
    switch (typeof rawChildren) {
      case "object":
        if (Array.isArray(rawChildren)) {
          this.loadArray(rawChildren);
        } else if (rawChildren instanceof Enumeration) {
          this.loadArray(rawChildren.list);
        } else if (rawChildren instanceof Sequence) {
          this.loadSequence(rawChildren, 0);
        } else if (rawChildren instanceof Repeatable) {
          this.loadRepeatable(rawChildren);
        } else {
          this.loadObject(rawChildren);
        }
        break;
      case "string":
        this.loadString(rawChildren);
        break;
      case "function":
        this.load(rawChildren());
        break;
      case "undefined":
        break;
      default:
        throw new Error("Not implemented");
    }
  }

  private loadObject(obj: SchemaObject) {
    Object.keys(obj).forEach((key: string) => {
      const val = obj[key];

      if (val === false) {
        // Only the "set groups" has the value false, like:
        // "groups(arg) | Configuration groups": opts?.groups !== false && { ... }
        // Just skip it.
      } else if (key.startsWith("arg")) {
        this.add(this.argNode(key, val));
      } else if (key.startsWith("null_") && val) {
        this.addNullNode(val);
      } else if (typeof key === "string") {
        this.addStringNode(key, val);
      } else {
        throw new Error("Not implemented");
      }
    });
  }

  private loadArray(array: string[]) {
    array.forEach((child) => {
      this.addStringNode(child, null);
    });
  }

  loadSequence(sequence: Sequence, depth: number) {
    const raw = sequence.get(depth);

    // This is actually complicated, might be buggy
    if (this.children.length === 0) {
      this.load(raw);
      this.children.forEach((child) => {
        child.loadSequence(sequence, depth + 1);
      });
    } else {
      this.children.forEach((child) => {
        child.load(raw);
        child.children.forEach((grandChild) => {
          grandChild.loadSequence(sequence, depth + 1);
        });
      });
    }
  }

  private loadString(string: string) {
    switch (string) {
      case "arg":
        this.add(new Node("arg", this, null, undefined, "arg"));
        break;
      default:
        throw new Error("Not implemented");
    }
  }

  loadRepeatable(repeatable: Repeatable) {
    this.load(repeatable.list);
    this.repeatable = true;
  }

  add(child: Node) {
    this.children.push(child);
  }

  addArrayString(args: string, description: string, rawChildren: SchemaObject | null) {
    args
      .split(/\s*\|\s*/)
      .filter((arg) => !arg.startsWith("$"))
      .forEach((arg) => {
        this.load({ [arg]: rawChildren });
      });
  }

  // This is a bit hacky, but migrates null node, which is originally nested choice element,
  // will be migrated to the parent.
  private addNullNode(children: SchemaObject) {
    this.load(children);
  }

  private addStringNode(key: string, rawChildren: SchemaObject | null) {
    const [name, description] = this.extractKey(key);
    const m = name.match(/(\S*)\((.*)\)/);

    if (!m) {
      this.add(new Node(name, this, rawChildren, description));
    } else if (m[1]) {
      // eg: unit($junos-underlying-interface-unit|$junos-interface-unit|arg)
      this.add(this.argumentStringNode(m[1], m[2], description, rawChildren));
    } else {
      // eg: (any-unicast|any-ipv4|any-ipv6|arg)
      this.addArrayString(m[2], description, rawChildren);
    }
  }

  private argNode(key: string, rawChildren: SchemaObject | null): Node {
    const [, description] = this.extractKey(key);
    // name may be "arg_1"
    return new Node("arg", this, rawChildren, description, "arg");
  }

  private argumentStringNode(name: string, args: string, description: string, rawChildren: SchemaObject | null): Node {
    const node = new Node(name, this, null, description);

    node.addArrayString(args, description, rawChildren);
    return node;
  }

  private extractKey(key: string): string[] {
    return key.split(" | ");
  }

  keywords(): string[] {
    return this.children.map((node) => node.name).sort();
  }

  find(string: string): Node | null {
    return (
      this.children.find((node) => node.name === string) || this.children.find((node) => node.type === "arg") || null
    );
  }
}

export class Parser {
  readonly ast: Node;
  repeatableNode?: Node;

  constructor(ast: Node) {
    this.ast = ast;
  }

  parse(string: string): Node | null {
    let ast: Node | null | undefined = this.ast;
    string
      .trim()
      .split(/\s+/)
      .forEach((word) => {
        ast = ast?.find(word);

        // Remember repeatable node matched to the substring
        if (ast?.repeatable) {
          this.repeatableNode = ast;
        }

        // If it has no child, use the repeatable node instead
        if (ast?.children.length === 0) {
          ast = this.repeatableNode;
        }
      });

    return ast;
  }

  keywords(string: string): string[] {
    let ast: Node | null = this.ast;
    string = string.trim();
    const defaultKeywords = ["apply-groups", "apply-groups-except"];

    // Hack for "groups" statement
    if (string) {
      if (string.match(/^groups\s*$|\s*apply-groups(-except)?$/)) {
        return ["word"];
      }
      string = string.replace(/apply-groups(-except)?\s+\S+$/, "");
    }

    // Hack for implicit interface-range "all"
    if (string?.match(/\s+interface$/)) {
      defaultKeywords.push("all");
    }

    if (string) {
      ast = this.parse(string);
    }

    const keywords =
      ast
        ?.keywords()
        .map((k) => (k === "arg" ? "word" : k)) // replace "arg" with "word"
        .concat(defaultKeywords) || [];

    return [...new Set(keywords)]; // uniq
  }

  description(string: string): string | undefined {
    if (!string) {
      return;
    }

    return this.parse(string)?.description;
  }
}

export function createParser() {
  const schema = new JunosSchema();
  const ast = new Node("configuration", null, schema.configuration());
  return new Parser(ast);
}
