type SchemaObject = { [key: string]: SchemaObject | null };

export class Enumeration {
    list: string[]
}

export class Repeatable {
    list: SchemaObject
}

export class Sequence {
    list: SchemaObject[]
    get(depth: number): SchemaObject
}

export class JunosSchema {
    configuration(): SchemaObject
}

