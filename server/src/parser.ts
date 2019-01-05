'use strict';

import {
	Repeatable
} from '../src/junos';

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

		if (raw_children instanceof Repeatable) {
			this.children = raw_children;
		} else if (raw_children !== null) {
			this.load(raw_children);
		}
	}

	load(raw_children) {
		switch (typeof raw_children) {
			case 'object':
				if (Array.isArray(raw_children)) {
					this.load_array(raw_children);
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

	private load_object(raw_children: Object) {
		Object.keys(raw_children).forEach((key: string) => {
			if (key.startsWith('arg')) {
				this.add(this.arg_node(key, raw_children[key]));
			} else if (key.startsWith('null_')) {
				this.add_null_node(raw_children[key]);
			} else if (typeof key === 'string') {
				this.add_string_node(key, raw_children[key]);
			} else {
				throw new Error('Not implemented');
			}
		});
	}

	private load_array(raw_children: string[]) {
		raw_children.forEach((child: string | null) => {
			this.add_string_node(child, null);
		});
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
		const match = name.match(/(\S*)\((.*)\)/);

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
		return new Node(name, this, raw_children, description, 'arg');
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
		const arg_child = this.children.find((node) => node.type === 'arg');
		if (arg_child) {
			return arg_child;
		}

		return this.children.find((node) => node.name === string);
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

		// NOTE: Hack for "groups" statement
		if (string) {
			if (string.match(/^\s*groups\s*$|\s*apply-groups\s*$/)) {
				return ['word'];
			}
			string = string.replace(/^\s*groups\s+\S+/, '');
			string = string.replace(/\s*apply-groups\s+\S+$/, '');
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

		return this.parse(string).description;
	}
}
