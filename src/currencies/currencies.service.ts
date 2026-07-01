import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Currency } from './entities/currency.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';

@Injectable()
export class CurrenciesService {
  // In-memory store, keyed by upper-cased currency code.
  private readonly currencies = new Map<string, Currency>();

  create(dto: CreateCurrencyDto): Currency {
    const code = dto.currency.trim().toUpperCase();

    if (this.currencies.has(code)) {
      throw new ConflictException(`Currency "${code}" already exists`);
    }

    const currency = new Currency(code, dto.monthlyFeeGbp);
    this.currencies.set(code, currency);
    return currency;
  }

  findAll(): Currency[] {
    return Array.from(this.currencies.values());
  }

  /** Returns the currency or throws a 404 - used by other modules (e.g. AccountsService). */
  getOrThrow(code: string): Currency {
    const currency = this.currencies.get(code.trim().toUpperCase());
    if (!currency) {
      throw new NotFoundException(`Currency "${code}" does not exist`);
    }
    return currency;
  }
}
