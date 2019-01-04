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
				this.load_object(raw_children);
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
		Object.keys(raw_children).forEach((key) => {
			if (key.startsWith('arg')) {
				this.add(this.arg_node(key, raw_children[key]));
			} else if (key.startsWith('null_')) {
				this.add_null_node(raw_children[key]);
			} else if (typeof key === 'string') {
				this.add(this.string_node(key, raw_children[key]));
			} else {
				throw new Error('Not implemented');
			}
		});
	}

	private load_string(string: string) {
		switch (string) {
			case 'arg':
				this.add(new Node('arg', this, null, null, 'arg'));
				break;
		}
	}

	add(child: Node) {
		this.children.push(child);
	}

	/*
	 * This is a bit hacky, but migrates null node, which is originally nested choice element,
	 * will be migrated to the parent.
	 */
	private add_null_node(children) {
		this.load(children);
	}

	private arg_node(key: string, raw_children): Node {
		const [name, description] = this.extract_key(key);
		return new Node(name, this, raw_children, description, 'arg');
	}

	private string_node(key: string, raw_children): Node {
		const [name, description] = this.extract_key(key);
		const match = name.match(/(\S+)\((.*)\)/);

		if (match) {
			// eg: unit($junos-underlying-interface-unit|$junos-interface-unit|arg)
			return this.argument_string_node(match[1], match[2], description, raw_children);
		} else {
			return new Node(name, this, raw_children, description);
		}
	}

	private argument_string_node(name: string, args: string, description: string, raw_children): Node {
		const node = new Node(name, this, null, description);

		args.split(/\s*\|\s*/)
			.filter((arg) => !arg.startsWith('$'))
			.forEach((arg) => {
				node.load({[arg]: raw_children});
			});

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

		if (string) {
			ast = this.parse(string);
		}

		// replace "arg" with "word"
		return ast ? ast.keywords().map((k) =>  k === 'arg' ? 'word' : k) : [];
	}

	description(string: string): string {
		if (!string) {
			return;
		}

		return this.parse(string).description;
	}
}
