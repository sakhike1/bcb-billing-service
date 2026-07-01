import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BillingService, TRANSACTION_FEE_GBP } from './billing.service';
import { AccountsService } from '../accounts/accounts.service';
import { CurrenciesService } from '../currencies/currencies.service';

describe('BillingService', () => {
  let billingService: BillingService;
  let accountsService: AccountsService;
  let currenciesService: CurrenciesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BillingService, AccountsService, CurrenciesService],
    }).compile();

    billingService = module.get(BillingService);
    accountsService = module.get(AccountsService);
    currenciesService = module.get(CurrenciesService);

    currenciesService.create({ currency: 'GBP', monthlyFeeGbp: 50 });
  });

  function createAccount(overrides: Partial<{
    accountId: string;
    currency: string;
    transactionThreshold: number;
    discountDays: number;
    discountRate: number;
  }> = {}) {
    return accountsService.create({
      accountId: 'acc-1',
      currency: 'GBP',
      transactionThreshold: 100,
      discountDays: 0,
      discountRate: 0,
      ...overrides,
    });
  }

  it('charges only the base fee when transactions are within the threshold and there is no discount', () => {
    createAccount({ transactionThreshold: 100, discountDays: 0, discountRate: 0 });

    const result = billingService.calculateBill('acc-1', {
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
      transactionCount: 50,
    });

    expect(result.breakdown.baseFeeGbp).toBe(50);
    expect(result.breakdown.billableTransactionCount).toBe(0);
    expect(result.breakdown.transactionFeesGbp).toBe(0);
    expect(result.breakdown.discount.amountGbp).toBe(0);
    expect(result.totalGbp).toBe(50);
  });

  it('charges a per-transaction fee only for transactions beyond the threshold', () => {
    createAccount({ transactionThreshold: 100, discountDays: 0, discountRate: 0 });

    const result = billingService.calculateBill('acc-1', {
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
      transactionCount: 130,
    });

    // 30 transactions over the threshold
    expect(result.breakdown.billableTransactionCount).toBe(30);
    expect(result.breakdown.transactionFeesGbp).toBe(30 * TRANSACTION_FEE_GBP);
    expect(result.totalGbp).toBe(50 + 30 * TRANSACTION_FEE_GBP);
  });

  it('applies the full discount when the billing period is entirely inside the promotional window', () => {
    // Freeze "now" so the account's createdAt is deterministic for the test.
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    createAccount({ transactionThreshold: 1000, discountDays: 60, discountRate: 0.2 });
    jest.useRealTimers();

    const result = billingService.calculateBill('acc-1', {
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
      transactionCount: 0,
    });

    // Entire period is within the 60-day discount window -> full 20% off the subtotal.
    expect(result.breakdown.discount.applicableFraction).toBe(1);
    expect(result.breakdown.discount.amountGbp).toBe(10); // 20% of 50
    expect(result.totalGbp).toBe(40);
  });

  it('applies zero discount once the promotional window has fully expired before the billing period', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    createAccount({ transactionThreshold: 1000, discountDays: 10, discountRate: 0.5 });
    jest.useRealTimers();

    const result = billingService.calculateBill('acc-1', {
      billingPeriodStart: '2026-03-01',
      billingPeriodEnd: '2026-03-31',
      transactionCount: 0,
    });

    expect(result.breakdown.discount.applicableFraction).toBe(0);
    expect(result.breakdown.discount.amountGbp).toBe(0);
    expect(result.totalGbp).toBe(50);
  });

  it('prorates the discount when only part of the billing period overlaps the promotional window', () => {
    // Account created 15 Jan, 20-day discount window -> window is 15 Jan - 04 Feb.
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'));
    createAccount({ transactionThreshold: 1000, discountDays: 20, discountRate: 0.5 });
    jest.useRealTimers();

    // Billing period 15 Jan - 14 Feb (30 days). Overlap with discount window is 15 Jan - 04 Feb (20 days).
    const result = billingService.calculateBill('acc-1', {
      billingPeriodStart: '2026-01-15',
      billingPeriodEnd: '2026-02-14',
      transactionCount: 0,
    });

    const expectedFraction = 20 / 30;
    expect(result.breakdown.discount.applicableFraction).toBeCloseTo(expectedFraction, 2);
    // 50% discount on the overlapping fraction of the £50 subtotal.
    expect(result.totalGbp).toBeCloseTo(50 - 50 * expectedFraction * 0.5, 1);
  });

  it('combines base fee, transaction fees, and a partial discount correctly end to end', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    createAccount({ transactionThreshold: 50, discountDays: 15, discountRate: 0.1 });
    jest.useRealTimers();

    // 30-day period, discount window covers first 15 days -> fraction = 15/30 = 0.5.
    const result = billingService.calculateBill('acc-1', {
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
      transactionCount: 80, // 30 over threshold
    });

    const subtotal = 50 + 30 * TRANSACTION_FEE_GBP; // 56
    const fraction = 15 / 30;
    const expectedTotal = subtotal - subtotal * fraction * 0.1;

    expect(result.breakdown.subtotalGbp).toBe(subtotal);
    expect(result.totalGbp).toBeCloseTo(expectedTotal, 1);
  });

  it('throws NotFoundException for an unknown account', () => {
    expect(() =>
      billingService.calculateBill('does-not-exist', {
        billingPeriodStart: '2026-01-01',
        billingPeriodEnd: '2026-01-31',
        transactionCount: 0,
      }),
    ).toThrow(NotFoundException);
  });

  it('throws BadRequestException when billingPeriodEnd is not after billingPeriodStart', () => {
    createAccount();

    expect(() =>
      billingService.calculateBill('acc-1', {
        billingPeriodStart: '2026-01-31',
        billingPeriodEnd: '2026-01-01',
        transactionCount: 0,
      }),
    ).toThrow('billingPeriodEnd must be after billingPeriodStart');
  });
});
