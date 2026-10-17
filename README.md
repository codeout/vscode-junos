# Junos Extension for Visual Studio Code

Junos extension for Visual Studio Code is a language server that provides auto-completion, validation, and syntax highlighting for Junos.


## Features

The language server has the following language features:

* Completion
* Syntax validation
* Syntax highlighting
* Go To Definition
  * `interface`
  * `prefix-list`
  * `policy-statement`
  * `community`
  * `as-path`
  * `as-path-group`
  * `firewall-filter`
  * NAT pool (`source-pool`, `destination-pool`, `dns-alg-pool`, `overload-pool`, `security nat ... then (source|destination)-nat pool`)
  * `address` and `address-set` in global and zone-specific address books, including `security nat ... match (source|destination)-address` and `security policies ... match (source|destination)-address`
  * `application` in `security policies ... match application`


## Requirements

* Visual Studio Code 1.100.0 or later


## Supported Junos

Completion and validation are driven by the NETCONF schema (xsd) of Junos 23.4, converted into a parser with [junoser](https://github.com/codeout/junoser). Syntax of other platforms is merged into the schema:

* `security`, `chassis cluster` and `chassis high-availability` of vSRX 22.4
* `poe` of EX 18.1
* `ethernet-switching-options` of 12.1

Platform differences are not modeled; a statement unsupported on the target device may still be reported as valid. Syntax introduced after the releases above is reported as invalid.


## Screen Shot

![Screen Shot](https://raw.githubusercontent.com/codeout/vscode-junos/refs/heads/main/docs/images/screen_shot01.gif)
![Screen Shot](https://raw.githubusercontent.com/codeout/vscode-junos/refs/heads/main/docs/images/screen_shot02.gif)


## Copyright and License

Copyright (c) 2019-2026 Shintaro Kojima. Code released under the [MIT license](LICENSE.txt).
