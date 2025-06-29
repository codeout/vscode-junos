export class ZoneAddressBookStore {
  private readonly store: {
    [uri: string]: {
      [logicalSystem: string]: {
        [zone: string]: Set<string>;
      };
    };
  };

  constructor() {
    this.store = {};
  }

  set(uri: string, logicalSystem: string, zone: string, addressBook: string): void {
    // initialize
    this.store[uri] ||= {};
    this.store[uri][logicalSystem] ||= {};
    this.store[uri][logicalSystem][zone] ||= new Set();

    this.store[uri][logicalSystem][zone].add(addressBook);
  }

  get(uri: string, logicalSystem: string, zone: string): Set<string> {
    return this.store[uri]?.[logicalSystem]?.[zone] || new Set(["global"]);
  }

  clear(uri: string, zone: string): void {
    if (!this.store[uri]) {
      return;
    }

    for (const logicalSystem in this.store[uri]) {
      this.store[uri][logicalSystem][zone] = new Set();
    }
  }
}
