import { IsInt, IsNumber, IsString, Length, Max, Min } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @Length(1, 100)
  accountId!: string;

  @IsString()
  @Length(1, 10)
  currency!: string;

  @IsInt()
  @Min(0)
  transactionThreshold!: number;

  @IsInt()
  @Min(0)
  discountDays!: number;

  /** Decimal fraction, e.g. 0.15 for a 15% discount. 0 is allowed (no discount). */
  @IsNumber()
  @Min(0)
  @Max(1)
  discountRate!: number;
}
