import httpMocks from 'node-mocks-http';

import { config } from '../../src/config';
import { UnauthenticatedException } from '../../src/exceptions';
import auth from '../../src/lib/auth';
import { tokenService } from '../../src/services';
import { generateCompany, insertCompanies } from '../fixtures/company.fixture';

describe('Auth', () => {
  it('should assign authenticated company to context if access token is valid', async () => {
    const [company] = await insertCompanies([generateCompany()]);

    const companyAccessToken = tokenService.generateAccessToken(company.id);

    const req: any = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${companyAccessToken}` },
    });

    const ctx: any = { req, res: httpMocks.createResponse() };

    await auth(ctx);

    expect(ctx.company).toEqual(company);
  });

  it('should assign authenticated company to context if access token is valid and email is verified', async () => {
    const [company] = await insertCompanies([
      { ...generateCompany(), emailVerifiedAt: new Date() },
    ]);

    const companyAccessToken = tokenService.generateAccessToken(company.id);

    const req: any = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${companyAccessToken}` },
    });

    const ctx: any = { req, res: httpMocks.createResponse() };

    await auth(ctx, true);

    expect(ctx.company).toEqual(company);
  });

  it('should throw authentication error if access token is not found in header', async () => {
    const ctx: any = { req: httpMocks.createRequest(), res: httpMocks.createResponse() };

    let error: any;
    try {
      await auth(ctx);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(UnauthenticatedException);
  });

  it('should throw authentication error if the token is invalid', async () => {
    const token = tokenService.generateOpaqueToken();
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${token}` } });

    const ctx: any = { req, res: httpMocks.createResponse() };

    let error: any;
    try {
      await auth(ctx);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(UnauthenticatedException);
  });

  it("should throw authentication error if company's email is not verified", async () => {
    const [company] = await insertCompanies([generateCompany()]);

    const accessToken = tokenService.generateAccessToken(company.id);

    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });

    const ctx: any = { req, res: httpMocks.createResponse() };

    let error: any;
    try {
      await auth(ctx, true);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(UnauthenticatedException);
  });

  it('should throw authentication error if access token is expired', async () => {
    const [company] = await insertCompanies([generateCompany()]);

    config.accessToken.maxAge = '-5m';
    const accessToken = tokenService.generateAccessToken(company.id);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });

    const ctx: any = { req, res: httpMocks.createResponse() };

    let error: any;
    try {
      await auth(ctx);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(UnauthenticatedException);
  });

  it('should throw authentication error if company is not found', async () => {
    const company = generateCompany();
    const accessToken = tokenService.generateAccessToken(company.id);
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const ctx: any = { req, res: httpMocks.createResponse() };

    let error: any;
    try {
      await auth(ctx);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(UnauthenticatedException);
  });
});
