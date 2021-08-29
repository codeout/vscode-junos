## [0.2.1] - 2021-08-30

### Fixed

* Line comment definition, that should be "#".


## [0.2.0] - 2021-05-05

### Added

* Recreate parser based on MX 19.3R3-S1.3 xsd


## [0.1.6] - 2019-11-05

### Added

* Newly supported syntax
  * `set security`


## [0.1.5] - 2019-11-04

### Added

* Newly supported syntax
  * Completion and validation of NAT pool name (`source-pool`, `destination-pool`, `dns-alg-pool`, `overload-pool`)


## [0.1.4] - 2019-03-03

### Fixed

* Unexpected vscode freeze due to URL pattern matching for syntax highlight


## [0.1.3] - 2019-01-18

### Added

* Tests of:
  * Completion
  * Validation

### Fixed

* Symbol definitions were flushed when another file is newly opened or edited


## [0.1.2] - 2019-01-15

### Added

* Experimentally implemented
  * Go To Definition
    * `interface`
    * `prefix-list`
    * `policy-statement`
    * `community`
    * `as-path`
    * `as-path-group`
    * `firewall-filter`
  * Completion and validation based on defined symbols


## [0.1.1] - 2019-01-10

### Added

* Newly supported syntax
  * `set system dump-on-panic`
  * `set protocols bgp minimum-hold-time xxx`

### Fixed

* route-filter
* Sequential statements


## [0.1.0] - 2019-01-07

### Added

* Completion based on NETCONF's xsd generated from vMX 17.2R1.13.
* Syntax validation
* Syntax highlighting
