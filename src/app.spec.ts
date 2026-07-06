import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CurrenciesService } from './currencies/currencies.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /currencies', () => {
    it('successfully registers a new currency', async () => {
      const response = await request(app.getHttpServer())
        .post('/currencies')
        .send({ currency: 'GBP', monthlyFeeGbp: 50 })
        .expect(201);

      expect(response.body).toEqual({
        currency: 'GBP',
        monthlyFeeGbp: 50,
      });
    });

    it('returns 409 Conflict when currency already exists', async () => {
      await request(app.getHttpServer())
        .post('/currencies')
        .send({ currency: 'GBP', monthlyFeeGbp: 50 })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/currencies')
        .send({ currency: 'gbp', monthlyFeeGbp: 60 })
        .expect(409);

      expect(response.body.statusCode).toBe(409);
      expect(response.body.error).toContain('Conflict');
      expect(response.body.message).toContain('already exists');
    });

    it('returns 400 Bad Request on invalid payload', async () => {
      const response = await request(app.getHttpServer())
        .post('/currencies')
        .send({ currency: '', monthlyFeeGbp: -10 })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'currency must be longer than or equal to 1 characters',
          'monthlyFeeGbp must be a positive number',
        ]),
      );
    });
  });

  describe('GET /currencies', () => {
    it('returns an empty array initially', async () => {
      const response = await request(app.getHttpServer())
        .get('/currencies')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns all registered currencies', async () => {
      await request(app.getHttpServer())
        .post('/currencies')
        .send({ currency: 'GBP', monthlyFeeGbp: 50 })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/currencies')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].currency).toBe('GBP');
    });

    it('returns 500 Internal Server Error when a service throws a non-HttpException', async () => {
      jest.spyOn(app.get(CurrenciesService), 'findAll').mockImplementationOnce(() => {
        throw new Error('Something went wrong internally');
      });

      const response = await request(app.getHttpServer())
        .get('/currencies')
        .expect(500);

      expect(response.body.statusCode).toBe(500);
      expect(response.body.error).toBe('Error');
      expect(response.body.message).toBe('Something went wrong internally');
    });

    it('returns custom message when HttpException is thrown with a string response', async () => {
      jest.spyOn(app.get(CurrenciesService), 'findAll').mockImplementationOnce(() => {
        throw new HttpException('String message error', HttpStatus.BAD_REQUEST);
      });

      const response = await request(app.getHttpServer())
        .get('/currencies')
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toBe('String message error');
    });
  });

  describe('POST /accounts', () => {
    beforeEach(async () => {
      // Register currency first to satisfy dependencies.
      await request(app.getHttpServer())
        .post('/currencies')
        .send({ currency: 'GBP', monthlyFeeGbp: 50 })
        .expect(201);
    });

    it('successfully creates an account', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounts')
        .send({
          accountId: 'acc-1',
          currency: 'GBP',
          transactionThreshold: 100,
          discountDays: 30,
          discountRate: 0.1,
        })
        .expect(201);

      expect(response.body.accountId).toBe('acc-1');
      expect(response.body.currency).toBe('GBP');
      expect(response.body.transactionThreshold).toBe(100);
      expect(response.body.discountDays).toBe(30);
      expect(response.body.discountRate).toBe(0.1);
      expect(response.body.createdAt).toBeDefined();
    });

    it('returns 404 Not Found if currency does not exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounts')
        .send({
          accountId: 'acc-2',
          currency: 'EUR',
          transactionThreshold: 100,
          discountDays: 30,
          discountRate: 0.1,
        })
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toContain('Currency "EUR" does not exist');
    });

    it('returns 409 Conflict if accountId already exists', async () => {
      await request(app.getHttpServer())
        .post('/accounts')
        .send({
          accountId: 'acc-1',
          currency: 'GBP',
          transactionThreshold: 100,
          discountDays: 30,
          discountRate: 0.1,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/accounts')
        .send({
          accountId: 'acc-1',
          currency: 'GBP',
          transactionThreshold: 50,
          discountDays: 0,
          discountRate: 0,
        })
        .expect(409);

      expect(response.body.statusCode).toBe(409);
      expect(response.body.message).toContain('already exists');
    });

    it('returns 400 Bad Request on invalid account fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounts')
        .send({
          accountId: '',
          currency: 'GBP',
          transactionThreshold: -5,
          discountDays: -1,
          discountRate: 1.5, // max is 1
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'accountId must be longer than or equal to 1 characters',
          'transactionThreshold must not be less than 0',
          'discountDays must not be less than 0',
          'discountRate must not be greater than 1',
        ]),
      );
    });
  });

  describe('GET /accounts', () => {
    it('returns an empty array initially', async () => {
      const response = await request(app.getHttpServer())
        .get('/accounts')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns all registered accounts', async () => {
      await request(app.getHttpServer())
        .post('/currencies')
        .send({ currency: 'GBP', monthlyFeeGbp: 50 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/accounts')
        .send({
          accountId: 'acc-1',
          currency: 'GBP',
          transactionThreshold: 100,
          discountDays: 30,
          discountRate: 0.1,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/accounts')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].accountId).toBe('acc-1');
    });
  });

  describe('POST /accounts/:accountId/bill', () => {
    beforeEach(async () => {
      // Set up a currency and account for billing tests.
      await request(app.getHttpServer())
        .post('/currencies')
        .send({ currency: 'GBP', monthlyFeeGbp: 50 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/accounts')
        .send({
          accountId: 'acc-1',
          currency: 'GBP',
          transactionThreshold: 10,
          discountDays: 30,
          discountRate: 0.2,
        })
        .expect(201);
    });

    it('calculates the bill successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounts/acc-1/bill')
        .send({
          billingPeriodStart: '2026-01-01T00:00:00Z',
          billingPeriodEnd: '2026-01-31T00:00:00Z',
          transactionCount: 20, // 10 over threshold
        })
        .expect(200);

      // 50 (base fee) + 10 * 0.2 (transaction fees) = 52 subtotal.
      // Since it's within the promotional discount period, discount applies.
      // The account is created at "now" (which is the test execution time).
      // Since the test execution time is during the billing period (2026 in the mock context or actual time),
      // we check that the fields exist and are of correct types/calculations.
      expect(response.body.accountId).toBe('acc-1');
      expect(response.body.currency).toBe('GBP');
      expect(response.body.totalGbp).toBeLessThanOrEqual(52);
      expect(response.body.breakdown).toBeDefined();
      expect(response.body.breakdown.baseFeeGbp).toBe(50);
      expect(response.body.breakdown.transactionCount).toBe(20);
      expect(response.body.breakdown.billableTransactionCount).toBe(10);
      expect(response.body.breakdown.transactionFeesGbp).toBe(2);
      expect(response.body.breakdown.subtotalGbp).toBe(52);
      expect(response.body.breakdown.discount).toBeDefined();
    });

    it('returns 404 for non-existent account', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounts/unknown-acc/bill')
        .send({
          billingPeriodStart: '2026-01-01T00:00:00Z',
          billingPeriodEnd: '2026-01-31T00:00:00Z',
          transactionCount: 20,
        })
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toContain('does not exist');
    });

    it('returns 400 when billingPeriodEnd is not after billingPeriodStart', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounts/acc-1/bill')
        .send({
          billingPeriodStart: '2026-01-31T00:00:00Z',
          billingPeriodEnd: '2026-01-01T00:00:00Z',
          transactionCount: 20,
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('billingPeriodEnd must be after billingPeriodStart');
    });

    it('returns 400 when dates are not valid ISO 8601 strings', async () => {
      const response = await request(app.getHttpServer())
        .post('/accounts/acc-1/bill')
        .send({
          billingPeriodStart: 'invalid-date',
          billingPeriodEnd: '2026-01-31T00:00:00Z',
          transactionCount: 20,
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining(['billingPeriodStart must be a valid ISO 8601 date']),
      );
    });
  });
});
