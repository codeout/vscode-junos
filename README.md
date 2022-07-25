# Junos Extension for Visual Studio Code

Junos extension for Visual Studio Code is a language server that provides auto-completion, validation, and syntax highlighting for Junos.


## Features

The language server has the following language features:

* Completion
* Syntax validation
* Syntax highlighting
  * Thanks to woodjme's [vscode-junos-syntax](https://github.com/woodjme/vscode-junos-syntax)

### Experimental Features

⚠️ These features may work, but still under development. The behavior might be changed ⚠️

* Go To Definition
  * `interface`
  * `prefix-list`
  * `policy-statement`
  * `community`
  * `as-path`
  * `as-path-group`
  * `firewall-filter`
  * NAT pool (`source-pool`, `destination-pool`, `dns-alg-pool`, `overload-pool`)


## Screen Shot

![Screen Shot](docs/images/screen_shot01.gif)
![Screen Shot](docs/images/screen_shot02.gif)


## Copyright and License

Copyright (c) 2019-2022 Shintaro Kojima. Code released under the [MIT license](LICENSE.txt).
