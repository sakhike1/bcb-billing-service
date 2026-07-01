import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { CurrenciesModule } from '../currencies/currencies.module';
import { BillingService } from '../billing/billing.service';

@Module({
  imports: [CurrenciesModule],
  controllers: [AccountsController],
  // BillingService is registered here (rather than its own module) because the
  // /accounts/:accountId/bill endpoint lives on AccountsController, and BillingService
  // itself depends on AccountsService - keeping it local avoids a circular module import.
  providers: [AccountsService, BillingService],
  exports: [AccountsService],
})
export class AccountsModule {}
