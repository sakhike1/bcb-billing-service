import { IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class CreateCurrencyDto {
  @IsString()
  @Length(1, 10)
  currency!: string;

  @IsNumber()
  @IsPositive()
  monthlyFeeGbp!: number;
}
