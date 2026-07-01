import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { CurrenciesService } from '../currencies/currencies.service';

@Injectable()
export class AccountsService {
  private readonly accounts = new Map<string, Account>();

  constructor(private readonly currenciesService: CurrenciesService) {}

  create(dto: CreateAccountDto): Account {
    if (this.accounts.has(dto.accountId)) {
      throw new ConflictException(`Account "${dto.accountId}" already exists`);
    }

    // Fail fast if the account references a currency that hasn't been registered yet.
    const currency = this.currenciesService.getOrThrow(dto.currency);

    const account = new Account({
      accountId: dto.accountId,
      currency: currency.currency,
      transactionThreshold: dto.transactionThreshold,
      discountDays: dto.discountDays,
      discountRate: dto.discountRate,
    });

    this.accounts.set(account.accountId, account);
    return account;
  }

  findAll(): Account[] {
    return Array.from(this.accounts.values());
  }

  getOrThrow(accountId: string): Account {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new NotFoundException(`Account "${accountId}" does not exist`);
    }
    return account;
  }
}
