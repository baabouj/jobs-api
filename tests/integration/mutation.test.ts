import cookie from 'cookie';
import pactum from 'pactum';

import { EXCEPTION_CODE } from '../../src/exceptions';
import { companyService, emailService, tokenService } from '../../src/services';
import { encrypt, exclu, hash, only } from '../../src/utils';
import { Company, generateCompany, insertCompanies } from '../fixtures/company.fixture';
import { generateJob, insertJobs, Job } from '../fixtures/job.fixture';
import setupServer from '../utils/setup';

setupServer();
describe('Mutation queries', () => {
  describe('MUTATION signup', () => {
    const signupQuery = `
      mutation Signup($company: SignUpInput) {
        signup(company: $company) {
          message
        }
      }
    `;
    let newCompany: Company & {
      confirm?: string;
    };
    beforeEach(() => {
      newCompany = generateCompany();
      newCompany.confirm = newCompany.password;
    });

    it('should successfully signup company if request data is ok and send verification email', async () => {
      const sendVerificationEmailSpy = jest.spyOn(emailService, 'sendVerificationEmail');

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(signupQuery)
        .withGraphQLVariables({
          company: exclu(newCompany, ['id', 'emailVerifiedAt']),
        })
        .expectJson({
          data: {
            signup: {
              message:
                'A link to activate your account has been emailed to the email address provided.',
            },
          },
        });

      const company = await companyService.findByEmail(newCompany.email);

      expect(sendVerificationEmailSpy).toHaveBeenCalledWith(
        company?.email as string,
        company?.id as string
      );
    });

    it('should return errors if request data is invalid', async () => {
      newCompany.email = 'invalidEmail';

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(signupQuery)
        .withGraphQLVariables({
          company: exclu(newCompany, ['id', 'emailVerifiedAt']),
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Arguments validation failed',
              code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR,
            },
          ],
        });
    });

    it('should return error if password length is less than 8 characters', async () => {
      newCompany.password = 'passwo1';

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(signupQuery)
        .withGraphQLVariables({
          company: exclu(newCompany, ['id', 'emailVerifiedAt']),
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Arguments validation failed',
              code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR,
            },
          ],
        });
    });

    it("should return error if password doesn't match", async () => {
      newCompany.confirm = 'notmatched';

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(signupQuery)
        .withGraphQLVariables({
          company: exclu(newCompany, ['id', 'emailVerifiedAt']),
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Arguments validation failed',
              code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR,
            },
          ],
        });
    });
  });

  describe('MUTATION login', () => {
    const loginQuery = `
      mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          access_token
        }
      }
    `;
    it('should successfully login company if email and password match', async () => {
      const company = generateCompany();
      await insertCompanies([company]);

      const loginCredentials = {
        email: company.email,
        password: company.password,
      };
      pactum.handler.addCaptureHandler('refresh token', (ctx) => {
        return cookie.parse(ctx.res.headers['set-cookie']?.[0] as string)['__Host-token'];
      });

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(loginQuery)
        .withGraphQLVariables(loginCredentials)
        .expectBodyContains('access_token')
        .expect((ctx) => {
          const payload = tokenService.decodeAccessToken(ctx.res.body.data.login.access_token);
          expect(payload?.sub).toBe(company.id);

          const cookies = cookie.parse(ctx.res.headers['set-cookie']?.[0] as string);
          expect(cookies).toHaveProperty('__Host-token');
        })
        .stores('access_token', 'data.login.access_token')
        .stores('refresh_token', '#refresh token');
    });

    it('should return error if there are no company with that email', async () => {
      const company = generateCompany();
      const loginCredentials = {
        email: company.email,
        password: company.password,
      };

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(loginQuery)
        .withGraphQLVariables(loginCredentials)
        .expectJsonLike({
          errors: [
            {
              message: 'Invalid email or password',
              code: EXCEPTION_CODE.BAD_USER_INPUT,
            },
          ],
        });
    });

    it('should return error if password is wrong', async () => {
      const company = generateCompany();
      await insertCompanies([company]);
      const loginCredentials = {
        email: company.email,
        password: 'wrongpassword',
      };

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(loginQuery)
        .withGraphQLVariables(loginCredentials)
        .expectJsonLike({
          errors: [
            {
              message: 'Invalid email or password',
              code: EXCEPTION_CODE.BAD_USER_INPUT,
            },
          ],
        });
    });
  });

  describe('MUTATION logout', () => {
    const logoutQuery = `
      mutation Logout {
        logout {
          message
        }
      }
    `;
    it('should successfully logged out', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(logoutQuery)
        .withHeaders('Authorization', 'Bearer $S{access_token}')
        .expectJson({
          data: {
            logout: {
              message: 'Logged out successfully',
            },
          },
        });
    });

    it('should return error if Authorization header is missing or has an invalid token', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(logoutQuery)
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(logoutQuery)
        .withHeaders('Authorization', 'Bearer invalidtoken')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });
  });

  describe('MUTATION refresh', () => {
    const refreshQuery = `
      mutation Refresh {
        refresh {
          access_token
        }
      }
    `;
    it('should return new access token if refresh token is valid', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(refreshQuery)
        .withCookies('__Host-token', '$S{refresh_token}')
        .expectBodyContains('access_token')
        .expect((ctx) => {
          const refreshTokenCookie = ctx.res.headers['set-cookie']?.[1];
          expect(refreshTokenCookie).toContain('__Host-token');
          expect(refreshTokenCookie).toContain('HttpOnly');
          expect(refreshTokenCookie).toContain('Secure');
        });
    });

    it('should return error if refresh token is already used', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(refreshQuery)
        .withCookies('__Host-token', '$S{refresh_token}')
        .expectJsonLike({
          errors: [
            {
              message: 'Invalid token',
              code: EXCEPTION_CODE.BAD_USER_INPUT,
            },
          ],
        });
    });

    it('should return error if refresh token is missing from request cookies', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(refreshQuery)
        .expectJsonLike({
          errors: [
            {
              message: 'Token is missing',
              code: EXCEPTION_CODE.BAD_USER_INPUT,
            },
          ],
        });
    });

    it("should return error if refresh token doesn't exist in database", async () => {
      const refreshToken = tokenService.generateOpaqueToken();

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(refreshQuery)
        .withCookies('__Host-token', encrypt(refreshToken))
        .expectJsonLike({
          errors: [
            {
              message: 'Invalid token',
              code: EXCEPTION_CODE.BAD_USER_INPUT,
            },
          ],
        });
    });
  });

  describe('MUTATION changePassword', () => {
    const changePasswordQuery = `
      mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
        changePassword(oldPassword: $oldPassword, newPassword: $newPassword) {
          message
        }
      }
    `;
    it('should successfully change password', async () => {
      const company = generateCompany();
      await insertCompanies([company]);

      const accessToken = tokenService.generateAccessToken(company.id);

      await pactum
        .spec()
        .post('/')
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .withGraphQLQuery(changePasswordQuery)
        .withGraphQLVariables({
          oldPassword: company.password,
          newPassword: 'password2',
        })
        .expectJson({
          data: {
            changePassword: {
              message: 'Password changed successfully',
            },
          },
        });
    });

    it('should return error if old password is wrong', async () => {
      const company = generateCompany();
      company.emailVerifiedAt = new Date();
      await insertCompanies([company]);

      const accessToken = tokenService.generateAccessToken(company.id);

      await pactum
        .spec()
        .post('/')
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .withGraphQLQuery(changePasswordQuery)
        .withGraphQLVariables({
          oldPassword: 'wrongpassword',
          newPassword: 'password2',
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Password change failed',
              code: EXCEPTION_CODE.BAD_USER_INPUT,
            },
          ],
        });
    });

    it('should return 401 error if not authorized', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(changePasswordQuery)
        .withGraphQLVariables({
          oldPassword: 'wrongpassword',
          newPassword: 'password2',
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });

    it('should return error if passwords are less than 8 characters', async () => {
      const company = generateCompany();
      await insertCompanies([company]);

      const accessToken = tokenService.generateAccessToken(company.id);

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(changePasswordQuery)
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .withGraphQLVariables({
          oldPassword: 'passwrd',
          newPassword: 'short',
        })
        .expectBodyContains('Arguments validation failed')
        .expectBodyContains('newPassword')
        .expectBodyContains('oldPassword');
    });
  });

  describe('MUTATION forgotPassword', () => {
    const forgotPasswordQuery = `
      mutation ForgotPassword($email: String!) {
        forgotPassword(email: $email) {
          message
        }
      }
    `;
    it('should send reset password email to the company if company exists', async () => {
      const company = generateCompany();
      await insertCompanies([company]);

      const sendResetPasswordEmailSpy = jest.spyOn(emailService, 'sendResetPasswordEmail');

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(forgotPasswordQuery)
        .withGraphQLVariables({ email: company.email })
        .expectJson({
          data: {
            forgotPassword: {
              message:
                'If that email address is in our database, an email is sent to reset your password',
            },
          },
        });

      expect(sendResetPasswordEmailSpy).toHaveBeenCalledWith(company.email, company.id);
    });

    it('should return error if email is invalid', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(forgotPasswordQuery)
        .withGraphQLVariables({ email: 'invalidemail' })
        .expectJsonLike({
          errors: [
            { message: 'Arguments validation failed', code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR },
          ],
        });
    });

    it("should not send reset password email if company with the given email doesn't exists", async () => {
      const company = generateCompany();

      const sendResetPasswordEmailSpy = jest.spyOn(emailService, 'sendResetPasswordEmail');

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(forgotPasswordQuery)
        .withGraphQLVariables({ email: company.email })
        .expectJson({
          data: {
            forgotPassword: {
              message:
                'If that email address is in our database, an email is sent to reset your password',
            },
          },
        });

      expect(sendResetPasswordEmailSpy).not.toHaveBeenCalled();
    });
  });

  describe('MUTATION resetPassword', () => {
    const resetPasswordQuery = `
      mutation ResetPassword($token: String!, $password: String!) {
        resetPassword(token: $token, password: $password) {
          message
        }
      }
    `;
    it('should reset password if token is valid', async () => {
      const [company] = await insertCompanies([generateCompany()]);

      const resetPasswordToken = await tokenService.generateAndSaveResetPasswordToken(company.id);

      const newPassword = 'newpassword';
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(resetPasswordQuery)
        .withGraphQLVariables({ token: resetPasswordToken, password: newPassword })
        .expectJson({
          data: {
            resetPassword: {
              message: 'Password reset successfully',
            },
          },
        });

      const updatedCompany = await companyService.find(company.id);

      const isMatched = await hash.check(updatedCompany?.password as string, newPassword);

      expect(isMatched).toBe(true);
    });

    it('should return error if password is less than 8 characters', async () => {
      const resetPasswordToken = tokenService.generateOpaqueToken();

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(resetPasswordQuery)
        .withGraphQLVariables({ token: resetPasswordToken, password: 'short' })
        .expectJsonLike({
          errors: [
            { message: 'Arguments validation failed', code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR },
          ],
        });
    });

    it("should return error if token is invalid or doesn't exist in db", async () => {
      const resetPasswordToken = tokenService.generateOpaqueToken();

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(resetPasswordQuery)
        .withGraphQLVariables({ token: 'invalidtoken', password: 'newpassword' })
        .expectJsonLike({
          errors: [
            {
              message: 'Password reset failed',
              code: EXCEPTION_CODE.BAD_USER_INPUT,
            },
          ],
        });

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(resetPasswordQuery)
        .withGraphQLVariables({ token: encrypt(resetPasswordToken), password: 'newpassword' })
        .expectJsonLike({
          errors: [
            {
              message: 'Password reset failed',
              code: EXCEPTION_CODE.BAD_USER_INPUT,
            },
          ],
        });
    });
  });

  describe('MUTATION verifyEmail', () => {
    const verifyEmailQuery = `
      mutation VerifyEmail($token: String!) {
        verifyEmail(token: $token) {
          message
        }
      }
    `;
    it('should verify email if token is valid', async () => {
      const company = generateCompany();
      await insertCompanies([company]);

      const emailVerificationToken = await tokenService.generateAndSaveEmailVerificationToken(
        company.id
      );

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(verifyEmailQuery)
        .withGraphQLVariables({ token: emailVerificationToken })
        .expectJson({
          data: {
            verifyEmail: {
              message: 'Email verified successfully',
            },
          },
        });

      const verifiedCompany = await companyService.find(company.id);

      expect(verifiedCompany?.emailVerifiedAt).toBeDefined();
    });
    it("should return error if token is invalid or company doesn't exist", async () => {
      const emailVerificationToken = tokenService.generateOpaqueToken();

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(verifyEmailQuery)
        .withGraphQLVariables({ token: 'invalidtoken' })
        .expectJsonLike({
          errors: [
            {
              message: 'Email verification failed',
            },
          ],
        });

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(verifyEmailQuery)
        .withGraphQLVariables({ token: encrypt(emailVerificationToken) })
        .expectJsonLike({
          errors: [
            {
              message: 'Email verification failed',
            },
          ],
        });
    });
  });

  describe('MUTATION sendVerificationEmail', () => {
    const sendVerificationEmailQuery = `
      mutation SendVerificationEmail {
        sendVerificationEmail {
          message
        }
      }
    `;
    it('should send verification email to the company', async () => {
      const [company] = await insertCompanies([generateCompany()]);
      const accessToken = tokenService.generateAccessToken(company.id);
      const sendVerificationEmailSpy = jest.spyOn(emailService, 'sendVerificationEmail');

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(sendVerificationEmailQuery)
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .expectJson({
          data: {
            sendVerificationEmail: {
              message:
                'If your email address is not already verified, an email is sent to verify your email address',
            },
          },
        });

      expect(sendVerificationEmailSpy).toHaveBeenCalledWith(company.email, company.id);
    });

    it("should not send verification email to the company if it's is already verified", async () => {
      const company = generateCompany();
      company.emailVerifiedAt = new Date();
      await insertCompanies([company]);
      const accessToken = tokenService.generateAccessToken(company.id);
      const sendVerificationEmailSpy = jest.spyOn(emailService, 'sendVerificationEmail');

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(sendVerificationEmailQuery)
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .expectJson({
          data: {
            sendVerificationEmail: {
              message:
                'If your email address is not already verified, an email is sent to verify your email address',
            },
          },
        });

      expect(sendVerificationEmailSpy).not.toHaveBeenCalledWith(company.email, company.id);
    });

    it('should return 401 if company is not authenticated', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(sendVerificationEmailQuery)
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });
  });

  describe('MUTATION postJob', () => {
    const company = generateCompany();
    company.emailVerifiedAt = new Date();
    beforeAll(async () => {
      await insertCompanies([company]);

      const accessToken = tokenService.generateAccessToken(company.id);
      pactum.request.setBearerToken(accessToken);
    });

    const postJobQuery = `
      mutation PostJob($job: PostJobInput!) {
        postJob(job: $job) {
          id
          title
          description
          type
          applicationLink
        }
      }
    `;
    let job: Job;
    beforeEach(() => {
      job = generateJob(company.id);
    });

    it('should successfully post job', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(postJobQuery)
        .withGraphQLVariables({
          job: exclu(job, ['id', 'companyId']),
        })
        .expectJsonLike({
          data: {
            postJob: {
              ...only(job, ['title', 'description', 'type', 'applicationLink']),
            },
          },
        });
    });

    it('should return error if data is invalid', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(postJobQuery)
        .withGraphQLVariables({
          job: {
            ...exclu(job, ['id', 'companyId']),
            applicationLink: 'invalidurl',
            type: 'invalidtype',
          },
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Arguments validation failed',
              code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR,
            },
          ],
        });
    });

    it("should return error if company's email is not verified", async () => {
      const unverifiedCompany = generateCompany();
      await insertCompanies([unverifiedCompany]);

      const accessToken = tokenService.generateAccessToken(unverifiedCompany.id);

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(postJobQuery)
        .withGraphQLVariables({ job: exclu(job, ['id', 'companyId']) })
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });

    it('should return error if not authenticated', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(postJobQuery)
        .withGraphQLVariables({ job: exclu(job, ['id', 'companyId']) })
        .withHeaders('Authorization', '')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(postJobQuery)
        .withGraphQLVariables({ job: exclu(job, ['id', 'companyId']) })
        .withHeaders('Authorization', 'Bearer invalidoken')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });
  });

  describe('MUTATION editJob', () => {
    const company = generateCompany();
    company.emailVerifiedAt = new Date();
    beforeAll(async () => {
      await insertCompanies([company]);

      const accessToken = tokenService.generateAccessToken(company.id);
      pactum.request.setBearerToken(accessToken);
    });

    const editJobQuery = `
      mutation EditJob($jobId: ID!, $job: EditJobInput!) {
        editJob(id: $jobId, job: $job) {
          id
          title
          description
          type
          applicationLink
        }
      }
    `;
    let job: Job;
    let newData: Omit<Job, 'id' | 'companyId'>;
    beforeEach(async () => {
      [job] = await insertJobs([generateJob(company.id)]);
      newData = exclu(generateJob(company.id), ['id', 'companyId']);
    });

    it('should successfully edit job', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editJobQuery)
        .withGraphQLVariables({
          jobId: job.id,
          job: newData,
        })
        .expectJson({
          data: {
            editJob: {
              id: job.id,
              ...only(newData, ['title', 'description', 'type', 'applicationLink']),
            },
          },
        });
    });

    it('should return error if data is invalid', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editJobQuery)
        .withGraphQLVariables({
          jobId: job.id,
          job: { ...newData, applicationLink: 'invalidurl', type: 'invalidtype' },
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Arguments validation failed',
              code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR,
            },
          ],
        });
    });

    it("should return error if job doesn't exist", async () => {
      const { id: jobId } = generateJob(company.id);
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editJobQuery)
        .withGraphQLVariables({
          jobId,
          job: newData,
        })
        .expectJsonLike({
          errors: [
            {
              message: `Job with id '${jobId}' doesn't exist`,
              code: EXCEPTION_CODE.NOT_FOUND,
            },
          ],
        });
    });

    it("should return error if company's email is not verified", async () => {
      const unverifiedCompany = generateCompany();
      await insertCompanies([unverifiedCompany]);

      const accessToken = tokenService.generateAccessToken(unverifiedCompany.id);

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editJobQuery)
        .withGraphQLVariables({
          jobId: job.id,
          job: newData,
        })
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });

    it('should return error if not authenticated', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editJobQuery)
        .withGraphQLVariables({
          jobId: job.id,
          job: newData,
        })
        .withHeaders('Authorization', '')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editJobQuery)
        .withGraphQLVariables({
          jobId: job.id,
          job: newData,
        })
        .withHeaders('Authorization', 'Bearer invalidoken')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });
  });

  describe('MUTATION deleteJob', () => {
    const company = generateCompany();
    company.emailVerifiedAt = new Date();
    beforeAll(async () => {
      await insertCompanies([company]);

      const accessToken = tokenService.generateAccessToken(company.id);
      pactum.request.setBearerToken(accessToken);
    });

    const deleteJobQuery = `
      mutation DeleteJob($jobId: ID!) {
        deleteJob(id: $jobId) {
          message
        }
      }
    `;

    it('should successfully delete job', async () => {
      const [{ id: jobId }] = await insertJobs([generateJob(company.id)]);
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(deleteJobQuery)
        .withGraphQLVariables({
          jobId,
        })
        .expectJson({
          data: {
            deleteJob: {
              message: 'Job deleted successfully',
            },
          },
        });
    });

    it("should return error if job doesn't exist", async () => {
      const { id: jobId } = generateJob(company.id);
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(deleteJobQuery)
        .withGraphQLVariables({
          jobId,
        })
        .expectJsonLike({
          errors: [
            {
              message: `Job with id '${jobId}' doesn't exist`,
              code: EXCEPTION_CODE.NOT_FOUND,
            },
          ],
        });
    });

    it("should return error if company's email is not verified", async () => {
      const unverifiedCompany = generateCompany();
      await insertCompanies([unverifiedCompany]);

      const [{ id: jobId }] = await insertJobs([generateJob(unverifiedCompany.id)]);

      const accessToken = tokenService.generateAccessToken(unverifiedCompany.id);

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(deleteJobQuery)
        .withGraphQLVariables({
          jobId,
        })
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });

    it('should return error if not authenticated', async () => {
      const { id: jobId } = generateJob(company.id);
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(deleteJobQuery)
        .withGraphQLVariables({ jobId })
        .withHeaders('Authorization', '')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(deleteJobQuery)
        .withGraphQLVariables({ jobId })
        .withHeaders('Authorization', 'Bearer invalidoken')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });
  });

  describe('MUTATION editCompany', () => {
    const editCompanyQuery = `
      mutation EditCompany($company: EditCompanyInput!) {
        editCompany(company: $company) {
          id
          name
          email
          description
          website
          logo
          headquarter
        }
      }
    `;
    let company: Company;
    let newData: Omit<Company, 'id' | 'password' | 'emailVerifiedAt' | 'email'>;
    beforeEach(async () => {
      [company] = await insertCompanies([generateCompany()]);
      newData = exclu(generateCompany(), ['id', 'password', 'emailVerifiedAt', 'email']);
      const accessToken = tokenService.generateAccessToken(company.id);
      pactum.request.setBearerToken(accessToken);
    });

    it('should successfully edit company', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editCompanyQuery)
        .withGraphQLVariables({
          companyId: company.id,
          company: newData,
        })
        .expectJson({
          data: {
            editCompany: {
              id: company.id,
              email: company.email,
              ...newData,
            },
          },
        });
    });

    it('should return error if data is invalid', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editCompanyQuery)
        .withGraphQLVariables({
          company: { ...newData, website: 'invalidurl', logo: 'invalidurl' },
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Arguments validation failed',
              code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR,
            },
          ],
        });
    });

    it('should return error if not authenticated', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editCompanyQuery)
        .withGraphQLVariables({
          company: newData,
        })
        .withHeaders('Authorization', '')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(editCompanyQuery)
        .withGraphQLVariables({
          company: newData,
        })
        .withHeaders('Authorization', 'Bearer invalidoken')
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: EXCEPTION_CODE.UNAUTHENTICATED,
            },
          ],
        });
    });
  });
});
