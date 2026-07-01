# BCB Tech Test — Billing Service

A billing API built with **TypeScript** and **NestJS**, using in-memory storage as permitted
by the spec.

## Running it

```bash
npm install
npm run build
npm run start        # or: npm run start:dev
```

The service listens on `http://localhost:3000` (override with `PORT`).

## Running the tests

```bash
npm test              # unit tests
npm run test:cov      # unit tests with coverage
```

There are 16 unit tests. Most importantly, `src/billing/billing.service.spec.ts` proves
the billing math itself: base fee only, transaction fees above threshold, full/zero/partial
discount proration, and an end-to-end case combining all three rules — plus the error paths
(unknown account, invalid date range).

## Project structure

```
src/
  currencies/     # POST /currencies  (+ GET /currencies for convenience)
  accounts/       # POST /accounts    (+ GET /accounts, POST /accounts/:id/bill)
  billing/        # BillingService - the actual calculation logic, kept separate
                  # from AccountsController/Service for a clean single responsibility
  common/filters/ # Global exception filter -> consistent JSON error shape
```

Each feature is a self-contained module (controller / service / DTO / entity), the pattern
NestJS is built around. `BillingService` depends on `AccountsService` and `CurrenciesService`
but has no controller of its own — the `/accounts/:accountId/bill` route lives on
`AccountsController` since it's scoped under `/accounts`, and it just delegates to
`BillingService`.

Validation is handled globally via a `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
`transform`) driven by `class-validator` decorators on each DTO, so malformed requests are
rejected before they ever reach a service.

## API

### `POST /currencies`
```json
{ "currency": "GBP", "monthlyFeeGbp": 50 }
```
Currency codes are case-insensitively unique (stored upper-cased). Duplicate → `409`.

### `POST /accounts`
```json
{
  "accountId": "acc-1",
  "currency": "GBP",
  "transactionThreshold": 100,
  "discountDays": 30,
  "discountRate": 0.1
}
```
`discountRate` is a decimal fraction (`0.1` = 10%). The referenced `currency` must already
exist → `404` if not. Duplicate `accountId` → `409`.

### `POST /accounts/:accountId/bill`
```json
{
  "billingPeriodStart": "2026-01-01",
  "billingPeriodEnd": "2026-01-31",
  "transactionCount": 130
}
```
Returns the total in GBP plus a full breakdown:
```json
{
  "accountId": "acc-1",
  "currency": "GBP",
  "billingPeriodStart": "2026-01-01T00:00:00.000Z",
  "billingPeriodEnd": "2026-01-31T00:00:00.000Z",
  "totalGbp": 60.55,
  "breakdown": {
    "baseFeeGbp": 50,
    "transactionThreshold": 100,
    "transactionCount": 130,
    "billableTransactionCount": 30,
    "transactionFeeRateGbp": 0.2,
    "transactionFeesGbp": 6,
    "subtotalGbp": 56,
    "discount": {
      "ratePercent": 10,
      "applicableFraction": 0.97,
      "amountGbp": 5.45
    }
  }
}
```
Unknown account → `404`. `billingPeriodEnd` not after `billingPeriodStart`, or either not a
valid ISO 8601 date → `400`.

## Worked example (curl)

```bash
curl -X POST localhost:3000/currencies -H 'Content-Type: application/json' \
  -d '{"currency":"GBP","monthlyFeeGbp":50}'

curl -X POST localhost:3000/accounts -H 'Content-Type: application/json' \
  -d '{"accountId":"acc-1","currency":"GBP","transactionThreshold":100,"discountDays":30,"discountRate":0.1}'

curl -X POST localhost:3000/accounts/acc-1/bill -H 'Content-Type: application/json' \
  -d '{"billingPeriodStart":"2026-01-01","billingPeriodEnd":"2026-01-31","transactionCount":130}'
```

## Design decisions & assumptions

The spec deliberately leaves a few things open. Here's how they were resolved, and why:

1. **Per-transaction fee amount isn't specified anywhere in the payloads.** `POST /currencies`
   only carries a monthly fee, and `POST /accounts` has no fee field either. Rather than
   silently inventing a request field the spec doesn't define, a single flat rate
   (`TRANSACTION_FEE_GBP = £0.20`, in `billing.service.ts`) is applied to every billable
   transaction across all accounts. In a real system this would more sensibly live per
   currency or per account — flagged clearly in code as an assumption, and trivial to turn
   into a real field later.

2. **Base fee is not prorated.** Each call to `/accounts/:accountId/bill` is treated as
   billing one full monthly cycle, so the full `monthlyFeeGbp` is always charged regardless
   of the exact number of days in `billingPeriodStart`–`billingPeriodEnd`. The alternative —
   prorating by `periodDays / daysInMonth` — was considered but adds an arbitrary "what is a
   month" assumption without the spec asking for it.

3. **Promotional discount is prorated by overlap, not all-or-nothing.** "a percentage
   discount applied for a specific number of days after they are created" defines a discount
   *window* (`[createdAt, createdAt + discountDays)`), not necessarily a whole billing period.
   If a billing period only partially overlaps that window (e.g. the promo expires mid-period),
   this service applies the discount rate to the overlapping *fraction* of the subtotal, rather
   than either discounting the whole bill or none of it. This felt like the most defensible
   reading of "for a specific number of days" and is covered by dedicated tests for the full,
   zero, and partial overlap cases.

4. **Currency codes are case-insensitive and stored upper-cased**, so `gbp` and `GBP` refer to
   the same currency — avoids duplicate/near-duplicate entries from casing alone.

5. **No database, as explicitly permitted by the spec.** Both `CurrenciesService` and
   `AccountsService` use in-memory `Map`s. Swapping in a real persistence layer would only
   touch these two services (their public interface — `create` / `findAll` / `getOrThrow` —
   would stay the same), everything else is unaffected.
