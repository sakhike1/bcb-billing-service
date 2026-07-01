export class Account {
  accountId: string;

  /** Currency code this account is billed in (must exist in CurrenciesService). */
  currency: string;

  /** Number of "free" transactions per billing month before per-transaction fees kick in. */
  transactionThreshold: number;

  /** Number of days after account creation during which the promotional discount applies. */
  discountDays: number;

  /** Promotional discount rate, expressed as a decimal fraction (e.g. 0.1 = 10%). */
  discountRate: number;

  /** Timestamp the account was created - the anchor for the promotional discount window. */
  createdAt: Date;

  constructor(params: {
    accountId: string;
    currency: string;
    transactionThreshold: number;
    discountDays: number;
    discountRate: number;
    createdAt?: Date;
  }) {
    this.accountId = params.accountId;
    this.currency = params.currency;
    this.transactionThreshold = params.transactionThreshold;
    this.discountDays = params.discountDays;
    this.discountRate = params.discountRate;
    this.createdAt = params.createdAt ?? new Date();
  }
}
