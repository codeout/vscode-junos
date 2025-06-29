export function isIpv4Prefix(prefix?: string): boolean {
  return !!prefix?.match(
    /^(?:(?:0|1(?:[0-9][0-9]?)?|2(?:[0-4][0-9]?|5[0-5]?|[6-9])?|[3-9][0-9]?)\.){3}(?:0|1(?:[0-9][0-9]?)?|2(?:[0-4][0-9]?|5[0-5]?|[6-9])?|[3-9][0-9]?)(?:\/(?:[0-2]?\d|3[0-2]))?$/,
  );
}

export function isIpv6Prefix(prefix?: string): boolean {
  return !!prefix?.match(
    /^(?:(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?::(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?|(?:[0-9A-Fa-f]{1,4}:){6,6}(\d+)\.(\d+)\.(\d+)\.(\d+)|(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?::((?:[0-9A-Fa-f]{1,4}:)*)(\d+)\.(\d+)\.(\d+)\.(\d+)|[Ff][Ee]80(?::[0-9A-Fa-f]{1,4}){7}%[-0-9A-Za-z._~]+|[Ff][Ee]80:(?:(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?::(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?|:(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?)?:[0-9A-Fa-f]{1,4}%[-0-9A-Za-z._~]+)(?:\/(?:[0-9]|[1-9]\d|1[01]\d|12[0-8]))?$/,
  );
}

export function isIpPrefix(prefix?: string): boolean {
  return isIpv4Prefix(prefix) || isIpv6Prefix(prefix);
}
