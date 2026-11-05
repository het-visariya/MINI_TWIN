/**
 * Live market prices, behind an interface with nothing behind it yet.
 *
 * Until MARKET_DATA_API_KEY is set, `getQuote` returns null for every symbol
 * and the Finance screen shows the value the user entered by hand next to
 * "Live prices: not connected". That is the honest state of affairs, and it is
 * better than a stale number shown as though it were today's.
 *
 * The real provider is added in the integrations round. It only has to satisfy
 * `PriceProvider`, and nothing in the UI changes.
 */

/** A quote in paise, to match how every other amount in the app is held. */
export type Quote = {
  symbol: string;
  priceMinor: number;
  asOf: Date;
  /** Named so the UI can say where the number came from. */
  source: string;
};

export interface PriceProvider {
  readonly kind: string;
  /** Null when the symbol is unknown, the provider is down, or there is none. */
  getQuote(symbol: string): Promise<Quote | null>;
  getQuotes(symbols: string[]): Promise<Map<string, Quote>>;
}

/**
 * The provider used when none is configured. Every method succeeds and returns
 * nothing — callers handle "no price" as a normal case, not an error, because
 * with no key that *is* the normal case.
 */
export const nullPriceProvider: PriceProvider = {
  kind: "null",

  async getQuote() {
    return null;
  },

  async getQuotes() {
    return new Map();
  },
};

export function getPriceProvider(): PriceProvider {
  /* When a key appears, this is the only line that changes. */
  return nullPriceProvider;
}

/** True when a real provider is wired up. Drives the UI's connection note. */
export function livePricesConnected(): boolean {
  return getPriceProvider().kind !== "null";
}
