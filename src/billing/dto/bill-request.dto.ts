import { IsInt, IsISO8601, Min } from 'class-validator';

export class BillRequestDto {
  @IsISO8601({ strict: true }, { message: 'billingPeriodStart must be a valid ISO 8601 date' })
  billingPeriodStart!: string;

  @IsISO8601({ strict: true }, { message: 'billingPeriodEnd must be a valid ISO 8601 date' })
  billingPeriodEnd!: string;

  @IsInt()
  @Min(0)
  transactionCount!: number;
}
