# Junos Extension for Visual Studio Code

Junos extension for Visual Studio Code is a language server that provides auto-completion, validation, and syntax highlighting for Junos.


## Features

The language server has the following language features:

* Completion
* Syntax validation
* Syntax highlighting
* Help texts on hover

Completion, validation and go to definition work for both `set` commands and the curly-brace format of `show configuration`.

### Experimental Features

⚠️ These features may work, but still under development. The behavior might be changed ⚠️

* Go To Definition, Find All References and Rename (except `interface`)
  * `interface`
  * `prefix-list`
  * `policy-statement`
  * `community`
  * `as-path`
  * `as-path-group`
  * `firewall-filter`
  * NAT pool (`source-pool`, `destination-pool`, `dns-alg-pool`, `overload-pool`)
  * address book entries, `application`
  * `routing-instance`, also as part of a routing table (`next-table VRF1.inet.0`, `import-rib`, `export-rib`)


## Junos schema

The extension's knowledge of Junos statements comes from `server/src/junos.js`, built by
[junoser](https://github.com/codeout/junoser) from Juniper's configuration XSD.

To build the extension with another schema in the same format, e.g. one built from the compiled DDL files
of Junos images with [junos-ddl-schema](../junos-ddl-schema), put it at `server/src/junos.local.js` (git
ignores it) or point `JUNOS_SCHEMA` at it, then run `npm run compile` or `npm run package`:

```
cp ../junos-ddl-schema/build/junos.js server/src/junos.local.js
npm run compile    # prints "using Junos schema .../junos.local.js"
```

A schema built from DDL also covers statements the Junos CLI hides (internal, unsupported, deprecated).
Validation always accepts them; the setting `junos.completion.hiddenStatements` (on by default) decides
whether completion offers them.


## Screen Shot

![Screen Shot](https://raw.githubusercontent.com/codeout/vscode-junos/refs/heads/main/docs/images/screen_shot01.gif)
![Screen Shot](https://raw.githubusercontent.com/codeout/vscode-junos/refs/heads/main/docs/images/screen_shot02.gif)


## Copyright and License

Copyright (c) 2019-2025 Shintaro Kojima. Code released under the [MIT license](LICENSE.txt).
