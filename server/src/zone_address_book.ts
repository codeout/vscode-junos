import { PointedSymbol } from "./definition";

export class ZoneAddressBookStore {
  private readonly store: {
    [uri: string]: {
      [logicalSystem: string]: {
        [zone: string]: string[];
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
    this.store[uri][logicalSystem][zone] ||= [];

    this.store[uri][logicalSystem][zone].push(addressBook);
  }

  /**
   * Return definition, [] when a given symbol is not defined, undefined when the symbol is undefined.
   * NOTE: It's important to return undefined in the last case to chain findings.
   *
   * @param uri
   * @param zone
   * @param symbol
   */
  get(uri: string, zone: string, symbol: PointedSymbol): string[] | undefined {
    if (!symbol.symbol) {
      return;
    }

    return this.store[uri]?.[symbol.logicalSystem]?.[zone] || [];
  }

  clear(uri: string, zone: string): void {
    if (!this.store[uri]) {
      return;
    }

    for (const logicalSystem in this.store[uri]) {
      this.store[uri][logicalSystem][zone] = [];
    }
  }
}
