# TODO

## Convert "set" commands to curly-brace format

The counterpart of "Junos: Convert to set commands": build the configuration tree from `set` lines
(and `deactivate` / `protect` / `delete` lines as `inactive:` / `protect:` / `delete:`), then print it the
way `show configuration` does: 4-space indentation, `;` after leaf statements, bracket lists kept,
statements in the order they were first set.

## Format Document

Once "set to brace" can print a tree, a document formatter is parse + print: curly-brace input is parsed
into the same tree and printed again. Needed for that:

- keep comments (`#`, `/* */`) and annotations, attached to the statement below them; the brace parser
  drops them today
- keep `## Warning:` blocks and `inactive:` / `protect:` markers
- leave `set` style documents alone (or format them as one `set` line per statement)
- refuse to format a document with structure errors (unmatched `}`) instead of guessing
