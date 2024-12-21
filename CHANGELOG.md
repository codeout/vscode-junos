## [0.4.0] - 2024-12-20

### Added

* Recreate parser based on MX 22.4R3-S2.11 xsd
* Newly supported syntax
  * "groups xxx when"
  * "snmp stats-cache-lifetime xxx"


## [0.3.6] - 2024-09-15

### Added

* Update vSRX syntax to 22.4R1.10
  * `security`
  * `chassis cluster`
* Completion and validation support
  * `security address-book xxx address-set xxx address`
  * `security address-book xxx address-set xxx address-set`
| * `security nat xxx pool xxx address-name`
| * `security nat ... match xxx-address`
  * `security policies ... match (source|destination)-address`

### Fixed

* Syntax highlight
  * `address-book`
  * `address-set` / `address`


## [0.3.5] - 2024-06-07

### Fixed

* Path to `.tmLanguage` for case-sensitive systems


## [0.3.4] - 2024-06-02

### Added

* Newly supported syntax
  * `interfaces xxx unit xxx enable`

### Fixed

* Parse of `set`, `delete`, `activate`, and `deactivate` at the end of a line


## [0.3.3] - 2024-05-19

### Added

* Newly supported syntax
  * `apply-groups-except`
  * `interfaces xxx enable`


## [0.3.2] - 2024-03-29

### Added

* Newly supported syntax
  * `set logical-systems`


## [0.3.1] - 2023-07-10

### Added

* Newly supported syntax
  * `chassis cluster`
  * `set security log stream xxx transport`

### Fixed

* `forwarding-options dhcp-relay server-group` was unexpectedly marked as invalid


## [0.3.0] - 2023-03-12

### Added

* Upgrade language server and client to 8.1.0
* Recreate parser based on MX 21.2R3-S2.9 xsd
* Newly supported syntax
  * `protocols iccp peer xxx liveness-detection single-hop`
  * `poe` based on EX 18.1R3-S6.1

### Fixed

* `interfaces xxx ether-options speed` was unexpectedly marked as invalid


## [0.2.6] - 2022-09-20

### Added

* Faster interface speed up to 800g

### Fixed

* `class-of-service interfaces all unit` to accept a unit number
* `classifiers` and `rewrite-rules` to accept arbitrary strings in various hierarchy
* `protocols mpls path xxx` to accept a next hop address
* `match` instead of `dest-nat-rule-match`, `src-nat-rule-match` or `static-nat-rule-match`


## [0.2.5] - 2022-07-26

### Fixed

* `interfaces interface-range xxx member-range`


## [0.2.4] - 2022-02-06

### Fixed

* Syntax highlight of `fxp?` and ipv6 address assigned interfaces


## [0.2.3] - 2021-10-28

### Added

* Completion and validation of `interface-range`


## [0.2.2] - 2021-10-18

### Fixed

* `set snmp name` instead of `set snmp system-name` which is a JUNOS problem


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
