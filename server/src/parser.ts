'use strict';

import {
    Enumeration,
    JunosSchema,
    Sequence
} from '../src/junos';

export const prefixPattern = /^[\t ]*(?:set|delete|activate|deactivate)/;


export class Node {
    name: string;
    parent: Node;
    children = [];
    description: string;
    type: string;

    constructor(name: string, parent: Node, raw_children, description?: string, type?: string) {
        this.name = name;
        this.parent = parent;
        this.description = description;
        this.type = type;

        if (raw_children instanceof Enumeration) {
            this.children = raw_children;
        } else if (raw_children !== null) {
            this.load(raw_children);
        }
    }

    load(raw_children) {
        switch (typeof raw_children) {
            case 'object':
                if (Array.isArray(raw_children) || raw_children instanceof Enumeration) {
                    this.load_array(raw_children);
                } else if (raw_children instanceof Sequence) {
                    this.load_sequence(raw_children, 0);
                } else {
                    this.load_object(raw_children);
                }
                break;
            case 'string':
                this.load_string(raw_children);
                break;
            case 'function':
                this.load(raw_children());
                break;
            case 'undefined':
                break;
            default:
                throw new Error('Not implemented');
        }
    }

    private load_object(obj: Object) {
        Object.keys(obj).forEach((key: string) => {
            if (key.startsWith('arg')) {
                this.add(this.arg_node(key, obj[key]));
            } else if (key.startsWith('null_')) {
                this.add_null_node(obj[key]);
            } else if (typeof key === 'string') {
                this.add_string_node(key, obj[key]);
            } else {
                throw new Error('Not implemented');
            }
        });
    }

    private load_array(array: string[]) {
        array.forEach((child: string | null) => {
            this.add_string_node(child, null);
        });
    }

    load_sequence(sequence: Sequence, depth: number) {
        const raw = sequence.get(depth);

        // NOTE: This is actually complicated, might be buggy
        if (this.children.length === 0) {
            this.load(raw);
            this.children.forEach(child => {
                child.load_sequence(sequence, depth + 1);
            });
        } else {
            this.children.forEach(child => {
                child.load(raw);
                child.children.forEach(grandChild => {
                    grandChild.load_sequence(sequence, depth + 1);
                });
            });
        }
    }

    private load_string(string: string) {
        switch (string) {
            case 'arg':
                this.add(new Node('arg', this, null, null, 'arg'));
                break;
            case 'any':
                // NOTE: This is only for "set groups", and all are done by another hack
                break;
            default:
                throw new Error('Not implemented');
        }
    }

    add(child: Node) {
        this.children.push(child);
    }

    add_array_string(args: string, description: string, raw_children) {
        args.split(/\s*\|\s*/)
            .filter((arg) => !arg.startsWith('$'))
            .forEach((arg) => {
                this.load({[arg]: raw_children});
            });
    }

    /*
     * This is a bit hacky, but migrates null node, which is originally nested choice element,
     * will be migrated to the parent.
     */
    private add_null_node(children) {
        this.load(children);
    }

    private add_string_node(key: string, raw_children) {
        const [name, description] = this.extract_key(key);
        const match: RegExpMatchArray = name.match(/(\S*)\((.*)\)/);

        if (!match) {
            this.add(new Node(name, this, raw_children, description));
        } else if (match[1]) {  // eg: unit($junos-underlying-interface-unit|$junos-interface-unit|arg)
            this.add(this.argument_string_node(match[1], match[2], description, raw_children));
        } else {  // eg: (any-unicast|any-ipv4|any-ipv6|arg)
            this.add_array_string(match[2], description, raw_children);
        }
    }

    private arg_node(key: string, raw_children): Node {
        const [name, description] = this.extract_key(key);
        // name may be "arg_1"
        return new Node('arg', this, raw_children, description, 'arg');
    }

    private argument_string_node(name: string, args: string, description: string, raw_children): Node {
        const node = new Node(name, this, null, description);

        node.add_array_string(args, description, raw_children);
        return node;
    }

    private extract_key(key: string): string[] {
        return key.split(' | ');
    }

    keywords(): string[] {
        return this.children.map((node) => node.name).sort();
    }

    find(string: string): Node {
        const child = this.children.find((node) => node.name === string);
        if (child) {
            return child;
        }

        return this.children.find((node) => node.type === 'arg');
    }
}

export class Parser {
    readonly ast: Node;

    constructor(ast: Node) {
        this.ast = ast;
    }

    parse(string: string): Node {
        let ast = this.ast;
        string.trim().split(/\s+/).forEach((word) => {
            if (ast) {
                ast = ast.find(word);
            }
        });

        return ast;
    }

    keywords(string: string): string[] {
        let ast = this.ast;
        string = string.trim();

        // NOTE: Hack for "groups" statement
        if (string) {
            if (string.match(/^groups\s*$|\s*apply-groups$/)) {
                return ['word'];
            }
            string = string.replace(/^groups\s+\S+/, '');
            string = string.replace(/apply-groups\s+\S+$/, '');
        }

        if (string) {
            ast = this.parse(string);
        }

        // replace "arg" with "word"
        return ast ? ast.keywords().map((k) => k === 'arg' ? 'word' : k).concat(['apply-groups']) : [];
    }

    description(string: string): string {
        if (!string) {
            return;
        }

        const node = this.parse(string);
        if (node) {
            return node.description;
        }
    }
}

export function createParser() {
    const schema = new JunosSchema();
    const ast = new Node('configuration', null, schema.configuration());
    return new Parser(ast);
}
