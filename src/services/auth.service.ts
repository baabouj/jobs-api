import { Company, Prisma } from '@prisma/client';

import { BadUserInputException } from '../exceptions';
import { prisma } from '../lib';
import { decrypt, hash } from '../utils';
import companyService from './company.service';
import emailService from './email.service';
import tokenService from './token.service';

const login = async (email: string, password: string) => {
  const company = await companyService.findByEmail(email);

  if (!company) throw new BadUserInputException('Invalid email or password');

  const isMatched = await hash.check(company.password, password);

  if (!isMatched) {
    throw new BadUserInputException('Invalid email or password');
  }

  return company;
};

const signup = async ({ password, ...company }: Prisma.CompanyCreateInput) => {
  try {
    const hashedPassword = await hash.make(password);

    const createdCompany = await prisma.company.create({
      data: { ...company, password: hashedPassword },
    });

    emailService.sendVerificationEmail(createdCompany.email, createdCompany.id);
  } catch (error) {
    // throw error if it's not a unique constraint error (email already exist)
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw error;
    }
  }
};

const verifyEmail = async (token: string) => {
  try {
    const foundToken = await tokenService.findEmailVerificationToken(decrypt(token));

    if (!foundToken || foundToken.blacklisted) throw new Error();

    await tokenService.blacklistToken(foundToken.id);

    if (foundToken.expiresAt.getTime() < Date.now()) throw new Error();

    await companyService.update(foundToken.companyId, {
      emailVerifiedAt: new Date(),
    });
  } catch {
    throw new BadUserInputException('Email verification failed');
  }
};

const changePassword = async (id: string, oldPassword: string, newPassword: string) => {
  try {
    const company = await companyService.find(id);

    if (!company) {
      throw new Error();
    }

    const isMatched = await hash.check(company.password, oldPassword);

    if (!isMatched) {
      throw new Error();
    }

    const newHashedPassword = await hash.make(newPassword);

    await companyService.update(company.id, { password: newHashedPassword });
  } catch {
    throw new BadUserInputException('Password change failed');
  }
};

const resetPassword = async (token: string, password: string) => {
  try {
    const foundToken = await tokenService.findResetPasswordToken(decrypt(token));

    if (!foundToken) throw new Error();

    await tokenService.deleteToken(foundToken.id);

    if (foundToken.expiresAt.getTime() < Date.now()) throw new Error();

    const hashedPassword = await hash.make(password);

    await companyService.update(foundToken.companyId, { password: hashedPassword });
  } catch {
    throw new BadUserInputException('Password reset failed');
  }
};

const sendVerificationEmail = async (company: Company) => {
  if (company.emailVerifiedAt) return;

  emailService.sendVerificationEmail(company.email, company.id);
};

const sendResetPasswordEmail = async (email: string) => {
  const company = await companyService.findByEmail(email);
  if (!company) return;

  emailService.sendResetPasswordEmail(email, company.id);
};

export default {
  login,
  signup,
  verifyEmail,
  changePassword,
  resetPassword,
  sendVerificationEmail,
  sendResetPasswordEmail,
};
