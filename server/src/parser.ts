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
    raw_children: SchemaObject | null,
    description?: string,
    type?: string,
  ) {
    this.name = name;
    this.parent = parent;
    this.description = description;
    this.type = type || null;

    if (raw_children !== null) {
      this.load(raw_children);
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  load(raw_children: string[] | Enumeration | Repeatable | Sequence | SchemaObject | Function) {
    switch (typeof raw_children) {
      case "object":
        if (Array.isArray(raw_children)) {
          this.load_array(raw_children);
        } else if (raw_children instanceof Enumeration) {
          this.load_array(raw_children.list);
        } else if (raw_children instanceof Sequence) {
          this.load_sequence(raw_children, 0);
        } else if (raw_children instanceof Repeatable) {
          this.load_repeatable(raw_children);
        } else {
          this.load_object(raw_children);
        }
        break;
      case "string":
        this.load_string(raw_children);
        break;
      case "function":
        this.load(raw_children());
        break;
      case "undefined":
        break;
      default:
        throw new Error("Not implemented");
    }
  }

  private load_object(obj: SchemaObject) {
    Object.keys(obj).forEach((key: string) => {
      const val = obj[key];

      if (key.startsWith("arg")) {
        this.add(this.arg_node(key, val));
      } else if (key.startsWith("null_") && val) {
        this.add_null_node(val);
      } else if (typeof key === "string") {
        this.add_string_node(key, val);
      } else {
        throw new Error("Not implemented");
      }
    });
  }

  private load_array(array: string[]) {
    array.forEach((child) => {
      this.add_string_node(child, null);
    });
  }

  load_sequence(sequence: Sequence, depth: number) {
    const raw = sequence.get(depth);

    // NOTE: This is actually complicated, might be buggy
    if (this.children.length === 0) {
      this.load(raw);
      this.children.forEach((child) => {
        child.load_sequence(sequence, depth + 1);
      });
    } else {
      this.children.forEach((child) => {
        child.load(raw);
        child.children.forEach((grandChild) => {
          grandChild.load_sequence(sequence, depth + 1);
        });
      });
    }
  }

  private load_string(string: string) {
    switch (string) {
      case "arg":
        this.add(new Node("arg", this, null, undefined, "arg"));
        break;
      case "any":
        // NOTE: This is only for "set groups", and all are done by another hack
        break;
      default:
        throw new Error("Not implemented");
    }
  }

  load_repeatable(repeatable: Repeatable) {
    this.load(repeatable.list);
    this.repeatable = true;
  }

  add(child: Node) {
    this.children.push(child);
  }

  add_array_string(args: string, description: string, raw_children: SchemaObject | null) {
    args
      .split(/\s*\|\s*/)
      .filter((arg) => !arg.startsWith("$"))
      .forEach((arg) => {
        this.load({ [arg]: raw_children });
      });
  }

  // This is a bit hacky, but migrates null node, which is originally nested choice element,
  // will be migrated to the parent.
  private add_null_node(children: SchemaObject) {
    this.load(children);
  }

  private add_string_node(key: string, raw_children: SchemaObject | null) {
    const [name, description] = this.extract_key(key);
    const match = name.match(/(\S*)\((.*)\)/);

    if (!match) {
      this.add(new Node(name, this, raw_children, description));
    } else if (match[1]) {
      // eg: unit($junos-underlying-interface-unit|$junos-interface-unit|arg)
      this.add(this.argument_string_node(match[1], match[2], description, raw_children));
    } else {
      // eg: (any-unicast|any-ipv4|any-ipv6|arg)
      this.add_array_string(match[2], description, raw_children);
    }
  }

  private arg_node(key: string, raw_children: SchemaObject | null): Node {
    const [name, description] = this.extract_key(key);
    // name may be "arg_1"
    return new Node("arg", this, raw_children, description, "arg");
  }

  private argument_string_node(
    name: string,
    args: string,
    description: string,
    raw_children: SchemaObject | null,
  ): Node {
    const node = new Node(name, this, null, description);

    node.add_array_string(args, description, raw_children);
    return node;
  }

  private extract_key(key: string): string[] {
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

    // NOTE: Hack for "groups" statement
    if (string) {
      if (string.match(/^groups\s*$|\s*apply-groups$/)) {
        return ["word"];
      }
      string = string.replace(/^groups\s+\S+/, "");
      string = string.replace(/apply-groups\s+\S+$/, "");
    }

    if (string) {
      ast = this.parse(string);
    }

    // replace "arg" with "word"
    return (
      ast
        ?.keywords()
        .map((k) => (k === "arg" ? "word" : k))
        .concat(["apply-groups"]) || []
    );
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
