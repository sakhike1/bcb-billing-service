import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CurrenciesService } from '../currencies/currencies.service';

describe('AccountsService', () => {
  let accountsService: AccountsService;
  let currenciesService: CurrenciesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, CurrenciesService],
    }).compile();

    accountsService = module.get(AccountsService);
    currenciesService = module.get(CurrenciesService);
  });

  it('creates an account when the referenced currency exists', () => {
    currenciesService.create({ currency: 'GBP', monthlyFeeGbp: 50 });

    const account = accountsService.create({
      accountId: 'acc-1',
      currency: 'GBP',
      transactionThreshold: 100,
      discountDays: 30,
      discountRate: 0.1,
    });

    expect(account.accountId).toBe('acc-1');
    expect(account.currency).toBe('GBP');
  });

  it('throws NotFoundException when the referenced currency does not exist', () => {
    expect(() =>
      accountsService.create({
        accountId: 'acc-1',
        currency: 'ZZZ',
        transactionThreshold: 100,
        discountDays: 30,
        discountRate: 0.1,
      }),
    ).toThrow(NotFoundException);
  });

  it('throws ConflictException when the accountId already exists', () => {
    currenciesService.create({ currency: 'GBP', monthlyFeeGbp: 50 });
    accountsService.create({
      accountId: 'acc-1',
      currency: 'GBP',
      transactionThreshold: 100,
      discountDays: 30,
      discountRate: 0.1,
    });

    expect(() =>
      accountsService.create({
        accountId: 'acc-1',
        currency: 'GBP',
        transactionThreshold: 50,
        discountDays: 0,
        discountRate: 0,
      }),
    ).toThrow(ConflictException);
  });

  it('throws NotFoundException from getOrThrow for an unknown account', () => {
    expect(() => accountsService.getOrThrow('missing')).toThrow(NotFoundException);
  });
});
