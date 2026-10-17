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


## Screen Shot

![Screen Shot](https://raw.githubusercontent.com/codeout/vscode-junos/refs/heads/main/docs/images/screen_shot01.gif)
![Screen Shot](https://raw.githubusercontent.com/codeout/vscode-junos/refs/heads/main/docs/images/screen_shot02.gif)


## Copyright and License

Copyright (c) 2019-2026 Shintaro Kojima. Code released under the [MIT license](LICENSE.txt).
