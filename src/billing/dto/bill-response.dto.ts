export interface BillBreakdown {
  baseFeeGbp: number;
  transactionThreshold: number;
  transactionCount: number;
  billableTransactionCount: number;
  transactionFeeRateGbp: number;
  transactionFeesGbp: number;
  subtotalGbp: number;
  discount: {
    ratePercent: number;
    /** Fraction (0-1) of the billing period that overlapped the promotional window. */
    applicableFraction: number;
    amountGbp: number;
  };
}

export interface BillResponse {
  accountId: string;
  currency: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalGbp: number;
  breakdown: BillBreakdown;
}
