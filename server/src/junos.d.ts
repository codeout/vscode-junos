// Only the "set groups" has the value false, like:
// "groups(arg) | Configuration groups": opts?.groups !== false && { ... }
type SchemaObject = { [key: string]: SchemaObject | null | false };

export class Enumeration {
  list: string[];
}

export class Repeatable {
  list: SchemaObject;
}

export class Sequence {
  list: SchemaObject[];

  get(depth: number): SchemaObject;
}

export class JunosSchema {
  configuration(): SchemaObject;
}
