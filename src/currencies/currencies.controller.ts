import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { Currency } from './entities/currency.entity';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCurrencyDto): Currency {
    return this.currenciesService.create(dto);
  }

  // Not required by the spec, but useful for manual verification / demoing the API.
  @Get()
  findAll(): Currency[] {
    return this.currenciesService.findAll();
  }
}
