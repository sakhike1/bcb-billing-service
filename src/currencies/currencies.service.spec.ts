import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';

describe('CurrenciesService', () => {
  let service: CurrenciesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrenciesService],
    }).compile();

    service = module.get(CurrenciesService);
  });

  it('creates and normalises the currency code to upper-case', () => {
    const currency = service.create({ currency: 'gbp', monthlyFeeGbp: 50 });
    expect(currency.currency).toBe('GBP');
    expect(currency.monthlyFeeGbp).toBe(50);
  });

  it('throws ConflictException when the currency already exists (case-insensitive)', () => {
    service.create({ currency: 'GBP', monthlyFeeGbp: 50 });
    expect(() => service.create({ currency: 'gbp', monthlyFeeGbp: 60 })).toThrow(ConflictException);
  });

  it('throws NotFoundException from getOrThrow when currency is missing', () => {
    expect(() => service.getOrThrow('USD')).toThrow(NotFoundException);
  });

  it('getOrThrow is case-insensitive', () => {
    service.create({ currency: 'GBP', monthlyFeeGbp: 50 });
    expect(service.getOrThrow('gbp').currency).toBe('GBP');
  });

  it('findAll returns all registered currencies', () => {
    service.create({ currency: 'GBP', monthlyFeeGbp: 50 });
    service.create({ currency: 'USD', monthlyFeeGbp: 40 });
    const list = service.findAll();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.currency)).toContain('GBP');
    expect(list.map((c) => c.currency)).toContain('USD');
  });
});
