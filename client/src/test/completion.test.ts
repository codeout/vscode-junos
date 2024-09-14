import * as assert from "assert";
import * as vscode from "vscode";

import { activate, getDocUri } from "./helper";

suite("Should do completion", () => {
  const docUri = getDocUri("junos.conf");

  test("Completes root config sections", async () => {
    await testCompletion(docUri, new vscode.Position(2, 4), {
      items: [
        { label: "access", kind: vscode.CompletionItemKind.Text },
        { label: "access-profile", kind: vscode.CompletionItemKind.Text },
        { label: "accounting-options", kind: vscode.CompletionItemKind.Text },
        { label: "applications", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "bridge-domains", kind: vscode.CompletionItemKind.Text },
        { label: "chassis", kind: vscode.CompletionItemKind.Text },
        { label: "class-of-service", kind: vscode.CompletionItemKind.Text },
        { label: "diameter", kind: vscode.CompletionItemKind.Text },
        { label: "dynamic-profiles", kind: vscode.CompletionItemKind.Text },
        { label: "ethernet-switching-options", kind: vscode.CompletionItemKind.Text },
        { label: "event-options", kind: vscode.CompletionItemKind.Text },
        { label: "fabric", kind: vscode.CompletionItemKind.Text },
        { label: "firewall", kind: vscode.CompletionItemKind.Text },
        { label: "forwarding-options", kind: vscode.CompletionItemKind.Text },
        { label: "groups", kind: vscode.CompletionItemKind.Text },
        { label: "ietf-interfaces:interfaces", kind: vscode.CompletionItemKind.Text },
        { label: "interfaces", kind: vscode.CompletionItemKind.Text },
        { label: "jsrc", kind: vscode.CompletionItemKind.Text },
        { label: "jsrc-partition", kind: vscode.CompletionItemKind.Text },
        { label: "logical-systems", kind: vscode.CompletionItemKind.Text },
        { label: "multi-chassis", kind: vscode.CompletionItemKind.Text },
        { label: "multicast-snooping-options", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-bfd:bfd", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-bgp:bgp", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-interfaces:interfaces", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-lacp:lacp", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-lldp:lldp", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-local-routing:local-routes", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-mpls:mpls", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-network-instance:network-instances", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-platform:components", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-qos:qos", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-routing-policy:routing-policy", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-system:system", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-telemetry:telemetry-system", kind: vscode.CompletionItemKind.Text },
        { label: "openconfig-vlan:vlans", kind: vscode.CompletionItemKind.Text },
        { label: "poe", kind: vscode.CompletionItemKind.Text },
        { label: "policy-options", kind: vscode.CompletionItemKind.Text },
        { label: "protocols", kind: vscode.CompletionItemKind.Text },
        { label: "rcsid", kind: vscode.CompletionItemKind.Text },
        { label: "routing-instances", kind: vscode.CompletionItemKind.Text },
        { label: "routing-options", kind: vscode.CompletionItemKind.Text },
        { label: "security", kind: vscode.CompletionItemKind.Text },
        { label: "services", kind: vscode.CompletionItemKind.Text },
        { label: "session-limit-group", kind: vscode.CompletionItemKind.Text },
        { label: "snmp", kind: vscode.CompletionItemKind.Text },
        { label: "switch-options", kind: vscode.CompletionItemKind.Text },
        { label: "system", kind: vscode.CompletionItemKind.Text },
        { label: "tenants", kind: vscode.CompletionItemKind.Text },
        { label: "unified-edge", kind: vscode.CompletionItemKind.Text },
        { label: "version", kind: vscode.CompletionItemKind.Text },
        { label: "virtual-chassis", kind: vscode.CompletionItemKind.Text },
        { label: "vlans", kind: vscode.CompletionItemKind.Text },
        { label: "vmhost", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes interface sections", async () => {
    await testCompletion(docUri, new vscode.Position(3, 24), {
      items: [
        { label: "accounting-profile", kind: vscode.CompletionItemKind.Text },
        { label: "aggregated-ether-options", kind: vscode.CompletionItemKind.Text },
        { label: "aggregated-inline-services-options", kind: vscode.CompletionItemKind.Text },
        { label: "aggregated-sonet-options", kind: vscode.CompletionItemKind.Text },
        { label: "anchor-point", kind: vscode.CompletionItemKind.Text },
        { label: "anchoring-options", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "arp-l2-validate", kind: vscode.CompletionItemKind.Text },
        { label: "atm-options", kind: vscode.CompletionItemKind.Text },
        { label: "auto-configure", kind: vscode.CompletionItemKind.Text },
        { label: "bypass-queueing-chip", kind: vscode.CompletionItemKind.Text },
        { label: "cascade-port", kind: vscode.CompletionItemKind.Text },
        { label: "cesopsn-options", kind: vscode.CompletionItemKind.Text },
        { label: "clocking", kind: vscode.CompletionItemKind.Text },
        { label: "container-options", kind: vscode.CompletionItemKind.Text },
        { label: "damping", kind: vscode.CompletionItemKind.Text },
        { label: "data-input", kind: vscode.CompletionItemKind.Text },
        { label: "dce", kind: vscode.CompletionItemKind.Text },
        { label: "description", kind: vscode.CompletionItemKind.Text },
        { label: "disable", kind: vscode.CompletionItemKind.Text },
        { label: "ds0-options", kind: vscode.CompletionItemKind.Text },
        { label: "dsl-options", kind: vscode.CompletionItemKind.Text },
        { label: "dsl-sfp-options", kind: vscode.CompletionItemKind.Text },
        { label: "e1-options", kind: vscode.CompletionItemKind.Text },
        { label: "e3-options", kind: vscode.CompletionItemKind.Text },
        { label: "enable", kind: vscode.CompletionItemKind.Text },
        { label: "encapsulation", kind: vscode.CompletionItemKind.Text },
        { label: "es-options", kind: vscode.CompletionItemKind.Text },
        { label: "esi", kind: vscode.CompletionItemKind.Text },
        { label: "ether-options", kind: vscode.CompletionItemKind.Text },
        { label: "ett-options", kind: vscode.CompletionItemKind.Text },
        { label: "external-model-name", kind: vscode.CompletionItemKind.Text },
        { label: "fabric-options", kind: vscode.CompletionItemKind.Text },
        { label: "fastether-options", kind: vscode.CompletionItemKind.Text },
        { label: "fibrechannel-options", kind: vscode.CompletionItemKind.Text },
        { label: "flexible-vlan-tagging", kind: vscode.CompletionItemKind.Text },
        { label: "forwarding-class-accounting", kind: vscode.CompletionItemKind.Text },
        { label: "framing", kind: vscode.CompletionItemKind.Text },
        { label: "ggsn-options", kind: vscode.CompletionItemKind.Text },
        { label: "gigether-options", kind: vscode.CompletionItemKind.Text },
        { label: "gratuitous-arp-reply", kind: vscode.CompletionItemKind.Text },
        { label: "hierarchical-scheduler", kind: vscode.CompletionItemKind.Text },
        { label: "hold-time", kind: vscode.CompletionItemKind.Text },
        { label: "ima-group-options", kind: vscode.CompletionItemKind.Text },
        { label: "ima-link-options", kind: vscode.CompletionItemKind.Text },
        { label: "input-native-vlan-push", kind: vscode.CompletionItemKind.Text },
        { label: "interface-mib", kind: vscode.CompletionItemKind.Text },
        { label: "interface-transmit-statistics", kind: vscode.CompletionItemKind.Text },
        { label: "keepalives", kind: vscode.CompletionItemKind.Text },
        { label: "l2tp-maximum-session", kind: vscode.CompletionItemKind.Text },
        { label: "layer2-policer", kind: vscode.CompletionItemKind.Text },
        { label: "link-degrade-monitor", kind: vscode.CompletionItemKind.Text },
        { label: "link-mode", kind: vscode.CompletionItemKind.Text },
        { label: "lmi", kind: vscode.CompletionItemKind.Text },
        { label: "load-balancing-options", kind: vscode.CompletionItemKind.Text },
        { label: "logical-tunnel-options", kind: vscode.CompletionItemKind.Text },
        { label: "lsq-failure-options", kind: vscode.CompletionItemKind.Text },
        { label: "mac", kind: vscode.CompletionItemKind.Text },
        { label: "media-type", kind: vscode.CompletionItemKind.Text },
        { label: "metadata", kind: vscode.CompletionItemKind.Text },
        { label: "mlfr-uni-nni-bundle-options", kind: vscode.CompletionItemKind.Text },
        { label: "mtu", kind: vscode.CompletionItemKind.Text },
        { label: "multi-chassis-protection", kind: vscode.CompletionItemKind.Text },
        { label: "multicast-statistics", kind: vscode.CompletionItemKind.Text },
        { label: "multiservice-options", kind: vscode.CompletionItemKind.Text },
        { label: "native-vlan-id", kind: vscode.CompletionItemKind.Text },
        { label: "no-bypass-queueing-chip", kind: vscode.CompletionItemKind.Text },
        { label: "no-gratuitous-arp-reply", kind: vscode.CompletionItemKind.Text },
        { label: "no-gratuitous-arp-request", kind: vscode.CompletionItemKind.Text },
        { label: "no-interface-mib", kind: vscode.CompletionItemKind.Text },
        { label: "no-keepalives", kind: vscode.CompletionItemKind.Text },
        { label: "no-native-vlan-insert", kind: vscode.CompletionItemKind.Text },
        { label: "no-no-gratuitous-arp-request", kind: vscode.CompletionItemKind.Text },
        { label: "no-partition", kind: vscode.CompletionItemKind.Text },
        { label: "no-per-unit-scheduler", kind: vscode.CompletionItemKind.Text },
        { label: "no-pseudowire-down-on-core-isolation", kind: vscode.CompletionItemKind.Text },
        { label: "no-traps", kind: vscode.CompletionItemKind.Text },
        { label: "number-of-sub-ports", kind: vscode.CompletionItemKind.Text },
        { label: "oam-on-svlan", kind: vscode.CompletionItemKind.Text },
        { label: "och-options", kind: vscode.CompletionItemKind.Text },
        { label: "odu-options", kind: vscode.CompletionItemKind.Text },
        { label: "optics-options", kind: vscode.CompletionItemKind.Text },
        { label: "otn-options", kind: vscode.CompletionItemKind.Text },
        { label: "otu-options", kind: vscode.CompletionItemKind.Text },
        { label: "partition", kind: vscode.CompletionItemKind.Text },
        { label: "passive-monitor-mode", kind: vscode.CompletionItemKind.Text },
        { label: "per-unit-scheduler", kind: vscode.CompletionItemKind.Text },
        { label: "port-mirror-instance", kind: vscode.CompletionItemKind.Text },
        { label: "ppp-options", kind: vscode.CompletionItemKind.Text },
        { label: "promiscuous-mode", kind: vscode.CompletionItemKind.Text },
        { label: "radius-options", kind: vscode.CompletionItemKind.Text },
        { label: "receive-bucket", kind: vscode.CompletionItemKind.Text },
        { label: "redundancy-group", kind: vscode.CompletionItemKind.Text },
        { label: "redundancy-options", kind: vscode.CompletionItemKind.Text },
        { label: "redundant-ether-options", kind: vscode.CompletionItemKind.Text },
        { label: "satop-options", kind: vscode.CompletionItemKind.Text },
        { label: "schedulers", kind: vscode.CompletionItemKind.Text },
        { label: "serial-options", kind: vscode.CompletionItemKind.Text },
        { label: "services-options", kind: vscode.CompletionItemKind.Text },
        { label: "shared-interface", kind: vscode.CompletionItemKind.Text },
        { label: "shared-scheduler", kind: vscode.CompletionItemKind.Text },
        { label: "shdsl-options", kind: vscode.CompletionItemKind.Text },
        { label: "sonet-options", kind: vscode.CompletionItemKind.Text },
        { label: "speed", kind: vscode.CompletionItemKind.Text },
        { label: "stacked-vlan-tagging", kind: vscode.CompletionItemKind.Text },
        { label: "switch-options", kind: vscode.CompletionItemKind.Text },
        { label: "t1-options", kind: vscode.CompletionItemKind.Text },
        { label: "t3-options", kind: vscode.CompletionItemKind.Text },
        { label: "tdm-options", kind: vscode.CompletionItemKind.Text },
        { label: "traceoptions", kind: vscode.CompletionItemKind.Text },
        { label: "transmit-bucket", kind: vscode.CompletionItemKind.Text },
        { label: "traps", kind: vscode.CompletionItemKind.Text },
        { label: "unidirectional", kind: vscode.CompletionItemKind.Text },
        { label: "unit", kind: vscode.CompletionItemKind.Text },
        { label: "unused", kind: vscode.CompletionItemKind.Text },
        { label: "vdsl-options", kind: vscode.CompletionItemKind.Text },
        { label: "vlan-offload", kind: vscode.CompletionItemKind.Text },
        { label: "vlan-tagging", kind: vscode.CompletionItemKind.Text },
        { label: "vlan-vci-tagging", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined prefix-list", async () => {
    await testCompletion(docUri, new vscode.Position(4, 67), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-prefix", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined policy-statement", async () => {
    await testCompletion(docUri, new vscode.Position(5, 41), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-statement", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined community", async () => {
    await testCompletion(docUri, new vscode.Position(6, 65), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-community", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined as-path", async () => {
    await testCompletion(docUri, new vscode.Position(7, 63), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-as-path", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined as-path-group", async () => {
    await testCompletion(docUri, new vscode.Position(8, 69), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-as-path-group", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined firewall filter", async () => {
    await testCompletion(docUri, new vscode.Position(9, 56), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-filter", kind: vscode.CompletionItemKind.Text },
        { label: "precedence", kind: vscode.CompletionItemKind.Text },
        { label: "shared-name", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined policy-statement only in logical-systems", async () => {
    await testCompletion(docUri, new vscode.Position(10, 56), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-import", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined prefix-list only in logical-systems", async () => {
    await testCompletion(docUri, new vscode.Position(11, 85), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "bar-prefix", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined nat pool", async () => {
    await testCompletion(docUri, new vscode.Position(12, 68), {
      items: [
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo-pool", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });

  test("Completes defined interface-range", async () => {
    await testCompletion(docUri, new vscode.Position(13, 29), {
      items: [
        { label: "all", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups", kind: vscode.CompletionItemKind.Text },
        { label: "apply-groups-except", kind: vscode.CompletionItemKind.Text },
        { label: "foo", kind: vscode.CompletionItemKind.Text },
        { label: "xe-0/0/0", kind: vscode.CompletionItemKind.Text },
        { label: "xe-0/0/0.0", kind: vscode.CompletionItemKind.Text },
        { label: "xe-0/0/1", kind: vscode.CompletionItemKind.Text },
        { label: "xe-0/0/1.0", kind: vscode.CompletionItemKind.Text },
      ],
    });
  });
});

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: vscode.CompletionList,
) {
  await activate(docUri);

  // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
  const actualCompletionList = (await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider",
    docUri,
    position,
  )) as vscode.CompletionList;

  assert.equal(actualCompletionList.items.length, expectedCompletionList.items.length);
  expectedCompletionList.items.forEach((expectedItem, i) => {
    const actualItem = actualCompletionList.items[i];
    assert.equal(actualItem.label, expectedItem.label);
    assert.equal(actualItem.kind, expectedItem.kind);
  });
}
