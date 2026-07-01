export class Currency {
  /** ISO-style currency code, e.g. "GBP", "USD". Stored upper-cased and used as the unique key. */
  currency: string;

  /** Monthly base fee for accounts billed in this currency, expressed in GBP (per spec, base fees are GBP-denominated). */
  monthlyFeeGbp: number;

  constructor(currency: string, monthlyFeeGbp: number) {
    this.currency = currency;
    this.monthlyFeeGbp = monthlyFeeGbp;
  }
}
