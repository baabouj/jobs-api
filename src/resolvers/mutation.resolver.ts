import ms from 'ms';

import { config } from '../config';
import { BadUserInputException, NotFoundException } from '../exceptions';
import { ForbiddenException } from '../exceptions/forbidden.exception';
import { redis, resolve } from '../lib';
import { authService, companyService, jobService, tokenService } from '../services';
import { decrypt, exclu } from '../utils';
import {
  ChangePasswordArgs,
  changePasswordSchema,
  CreateJobArgs,
  createJobSchema,
  ForgotPasswordArgs,
  forgotPasswordSchema,
  LoginArgs,
  loginSchema,
  ResetPasswordArgs,
  resetPasswordSchema,
  SignupArgs,
  signupSchema,
  UpdateCompanyArgs,
  updateCompanyArgsSchema,
  UpdateJobArgs,
  updateJobSchema,
  UuidArg,
  uuidArgSchema,
} from '../validations';

export default {
  login: resolve(
    async (_parent, { email, password }: LoginArgs, { req, res }) => {
      const company = await authService.login(email, password);

      const cookieToken: string = req.cookies['__Host-token'];

      if (cookieToken) {
        const decryptedToken = decrypt(cookieToken);

        if (decryptedToken) {
          const foundRefreshToken = await tokenService.findRefreshToken(decryptedToken);

          if (foundRefreshToken) await tokenService.deleteToken(foundRefreshToken.id);
        }

        res.clearCookie('__Host-token', {
          secure: true,
          httpOnly: true,
          sameSite: 'lax',
        });
      }

      const { accessToken, refreshToken } = await tokenService.generateAuthTokens(company.id);

      res.cookie('__Host-token', refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: ms(config.refreshToken.maxAge),
      });

      return {
        access_token: accessToken,
      };
    },
    {
      schema: loginSchema,
    }
  ),
  signup: resolve(
    async (_parent, { company }: SignupArgs) => {
      await authService.signup(exclu(company, ['confirm']));

      const keys = await redis.keys(`companies_*`);
      if (keys.length !== 0) await redis.del(keys);

      return {
        message: 'A link to activate your account has been emailed to the email address provided.',
      };
    },
    {
      schema: signupSchema,
    }
  ),
  refresh: resolve(async (_parent, _args, { req, res }) => {
    const cookieToken = req.cookies['__Host-token'];

    if (!cookieToken) throw new BadUserInputException('Token is missing');

    res.clearCookie('__Host-token', {
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    });

    const decryptedToken = decrypt(cookieToken);

    if (!decryptedToken) throw new BadUserInputException('Invalid token');

    const token = await tokenService.findRefreshToken(decryptedToken);
    if (!token) throw new BadUserInputException('Invalid token');

    if (token.blacklisted) {
      // Refresh token reuse detected!
      await tokenService.deleteCompanyRefreshTokens(token.companyId);

      throw new BadUserInputException('Invalid token');
    }

    const { accessToken, refreshToken } = await tokenService.generateAuthTokens(token.companyId);
    await tokenService.blacklistToken(token.id);

    res.cookie('__Host-token', refreshToken, {
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: ms(config.refreshToken.maxAge),
    });

    return {
      access_token: accessToken,
    };
  }),
  logout: resolve(
    async (_parent, _args, { req, res }) => {
      const token = req.cookies['__Host-token'];

      const decryptedToken = decrypt(token);

      if (token && decryptedToken) {
        res.clearCookie('__Host-token', {
          secure: true,
          httpOnly: true,
          sameSite: 'lax',
        });

        const refreshToken = await tokenService.findRefreshToken(decryptedToken);

        if (refreshToken) await tokenService.deleteToken(refreshToken.id);
      }

      return {
        message: 'Logged out successfully',
      };
    },
    {
      auth: true,
    }
  ),
  verifyEmail: resolve(async (_parent, { token }: { token: string }) => {
    await authService.verifyEmail(token);

    return {
      message: 'Email verified successfully',
    };
  }),
  changePassword: resolve(
    async (_parent, { oldPassword, newPassword }: ChangePasswordArgs, { company }) => {
      await authService.changePassword(company.id, oldPassword, newPassword);
      await tokenService.deleteCompanyRefreshTokens(company.id);

      return {
        message: 'Password changed successfully',
      };
    },
    {
      auth: true,
      schema: changePasswordSchema,
    }
  ),
  forgotPassword: resolve(
    async (_parent, { email }: ForgotPasswordArgs) => {
      await authService.sendResetPasswordEmail(email);

      return {
        message:
          'If that email address is in our database, an email is sent to reset your password',
      };
    },
    {
      schema: forgotPasswordSchema,
    }
  ),
  resetPassword: resolve(
    async (_parent, { token, password }: ResetPasswordArgs) => {
      await authService.resetPassword(token, password);

      return {
        message: 'Password reset successfully',
      };
    },
    {
      schema: resetPasswordSchema,
    }
  ),
  sendVerificationEmail: resolve(
    async (_parent, _args, { company }) => {
      await authService.sendVerificationEmail(company);

      return {
        message:
          'If your email address is not already verified, an email is sent to verify your email address',
      };
    },
    {
      auth: true,
    }
  ),
  postJob: resolve(
    async (_parent, { job }: CreateJobArgs, { company }) => {
      const postedJob = await jobService.create(company.id, job);
      await redis.set(`job_${postedJob.id}`, JSON.stringify(postedJob), {
        EX: 60 * 5,
      });

      const keys = [
        ...(await redis.keys(`jobs_*`)),
        ...(await redis.keys(`company_${company.id}_jobs_*`)),
      ];

      if (keys.length !== 0) await redis.del(keys);

      return postedJob;
    },
    {
      auth: true,
      verified: true,
      schema: createJobSchema,
    }
  ),
  editJob: resolve(
    async (_parent, { id: jobId, job }: UpdateJobArgs, { company }) => {
      const jobToUpdate = await jobService.find(jobId);

      if (!jobToUpdate) throw new NotFoundException(`Job with id '${jobId}' doesn't exist`);
      if (jobToUpdate.companyId !== company.id) throw new ForbiddenException();

      const updatedJob = await jobService.update(jobToUpdate.id, job);

      await redis.set(`job_${updatedJob.id}`, JSON.stringify(updatedJob), {
        EX: 60 * 5,
      });

      const keys = [
        ...(await redis.keys(`jobs_*`)),
        ...(await redis.keys(`company_${company.id}_jobs_*`)),
      ];

      if (keys.length !== 0) await redis.del(keys);
      return updatedJob;
    },
    {
      auth: true,
      verified: true,
      schema: updateJobSchema,
    }
  ),
  deleteJob: resolve(
    async (_parent, { id: jobId }: UuidArg, { company }) => {
      const jobToDelete = await jobService.find(jobId);

      if (!jobToDelete) throw new NotFoundException(`Job with id '${jobId}' doesn't exist`);
      if (jobToDelete.companyId !== company.id) throw new ForbiddenException();

      await jobService.delete(jobToDelete.id);

      const keys = [
        ...(await redis.keys(`jobs_*`)),
        ...(await redis.keys(`company_${company.id}_jobs_*`)),
        `job_${jobToDelete.id}`,
      ];

      await redis.del(keys);

      return { message: 'Job deleted successfully' };
    },
    {
      auth: true,
      verified: true,
      schema: uuidArgSchema,
    }
  ),
  editCompany: resolve(
    async (_parent, { company: data }: UpdateCompanyArgs, { company }) => {
      const updatedCompany = await companyService.update(company.id, data);
      await redis.set(`company_${updatedCompany.id}`, JSON.stringify(updatedCompany), {
        EX: 60 * 5,
      });
      return updatedCompany;
    },
    {
      auth: true,
      schema: updateCompanyArgsSchema,
    }
  ),
};
