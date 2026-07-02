import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { Account } from './entities/account.entity';
import { BillingService } from '../billing/billing.service';
import { BillRequestDto } from '../billing/dto/bill-request.dto';
import { BillResponse } from '../billing/dto/bill-response.dto';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly billingService: BillingService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAccountDto): Account {
    return this.accountsService.create(dto);
  }

  // Not required by the spec, but useful for manual verification / demoing the API.
  @Get()
  findAll(): Account[] {
    return this.accountsService.findAll();
  }

  @Post(':accountId/bill')
  @HttpCode(HttpStatus.OK)
  bill(@Param('accountId') accountId: string, @Body() dto: BillRequestDto): BillResponse {
    return this.billingService.calculateBill(accountId, dto);
  }
}
