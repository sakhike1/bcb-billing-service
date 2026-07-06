import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { BillRequestDto } from './dto/bill-request.dto';
import { BillResponse } from './dto/bill-response.dto';
import { addDays, overlapMs, roundMoney } from './billing.util';

/**
 * Flat fee (in GBP) charged for every transaction beyond an account's monthly threshold.
 *
 * ASSUMPTION: the spec's request/response payloads don't define where a per-transaction
 * fee amount comes from, so a single flat rate is used across all accounts/currencies here.
 * In a real system this would more likely live per-currency or per-account (e.g. an extra
 * `transactionFeeGbp` field on `POST /currencies` or `POST /accounts`) - see README.
 */
export const TRANSACTION_FEE_GBP = 0.2;

@Injectable()
export class BillingService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly currenciesService: CurrenciesService,
  ) {}

  calculateBill(accountId: string, dto: BillRequestDto): BillResponse {
    const account = this.accountsService.getOrThrow(accountId);
    const currency = this.currenciesService.getOrThrow(account.currency);

    const periodStart = new Date(dto.billingPeriodStart);
    const periodEnd = new Date(dto.billingPeriodEnd);

    if (periodEnd.getTime() <= periodStart.getTime()) {
      throw new BadRequestException('billingPeriodEnd must be after billingPeriodStart');
    }

    // 1. Base fee - the account's currency determines the flat monthly fee.
    // ASSUMPTION: each bill call represents one full monthly billing cycle, so the full
    // monthly fee is charged regardless of the exact period length (no proration).
    const baseFeeGbp = currency.monthlyFeeGbp;

    // 2. Transaction fees - only transactions beyond the account's threshold are billable.
    const billableTransactionCount = Math.max(
      0,
      dto.transactionCount - account.transactionThreshold,
    );
    const transactionFeesGbp = billableTransactionCount * TRANSACTION_FEE_GBP;

    const subtotalGbp = baseFeeGbp + transactionFeesGbp;

    // 3. Promotional discount - applies for `discountDays` days after the account was
    // created. If the billing period only partially overlaps that promotional window,
    // the discount is applied proportionally to the overlapping fraction of the period.
    const discountWindowStart = account.createdAt;
    const discountWindowEnd = addDays(account.createdAt, account.discountDays);

    const totalPeriodMs = periodEnd.getTime() - periodStart.getTime();
    const overlapMillis = overlapMs(periodStart, periodEnd, discountWindowStart, discountWindowEnd);
    const applicableFraction = totalPeriodMs > 0 ? overlapMillis / totalPeriodMs : 0;

    const discountAmountGbp = subtotalGbp * applicableFraction * account.discountRate;

    const totalGbp = subtotalGbp - discountAmountGbp;

    return {
      accountId: account.accountId,
      currency: currency.currency,
      billingPeriodStart: periodStart.toISOString(),
      billingPeriodEnd: periodEnd.toISOString(),
      totalGbp: roundMoney(totalGbp),
      breakdown: {
        baseFeeGbp: roundMoney(baseFeeGbp),
        transactionThreshold: account.transactionThreshold,
        transactionCount: dto.transactionCount,
        billableTransactionCount,
        transactionFeeRateGbp: TRANSACTION_FEE_GBP,
        transactionFeesGbp: roundMoney(transactionFeesGbp),
        subtotalGbp: roundMoney(subtotalGbp),
        discount: {
          ratePercent: roundMoney(account.discountRate * 100),
          applicableFraction: roundMoney(applicableFraction),
          amountGbp: roundMoney(discountAmountGbp),
        },
      },
    };
  }
}
