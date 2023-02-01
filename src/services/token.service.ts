import { TokenType } from '@prisma/client';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import ms from 'ms';

import { config } from '../config';
import { prisma } from '../lib';
import { decrypt, encrypt } from '../utils';

const generateJWT = (companyId: string, secret: string, expiresIn: string): string => {
  const token = jwt.sign({ sub: companyId }, secret, {
    expiresIn,
  });

  return encrypt(token);
};

const decodeJWToken = (token: string, secret: string) => {
  try {
    const payload = jwt.verify(decrypt(token), secret);

    return payload as { sub: string; type: TokenType };
  } catch {
    return null;
  }
};

const saveToken = (companyId: string, token: string, type: TokenType, expires: number) => {
  const expiresAt = new Date(expires);
  return prisma.token.create({
    data: {
      token,
      type,
      companyId,
      expiresAt,
    },
  });
};

const findToken = (token: string, type: TokenType) => {
  return prisma.token.findFirst({
    where: {
      token,
      type,
    },
  });
};

const deleteToken = async (id: string) => {
  return prisma.token.delete({
    where: {
      id,
    },
  });
};

const blacklistToken = async (id: string) => {
  return prisma.token.update({
    where: {
      id,
    },
    data: {
      blacklisted: true,
    },
  });
};

const generateOpaqueToken = () => {
  return randomBytes(24).toString('base64');
};

const generateAccessToken = (companyId: string): string => {
  return generateJWT(companyId, config.accessToken.secret, config.accessToken.maxAge);
};

const decodeAccessToken = (token: string) => {
  return decodeJWToken(token, config.accessToken.secret);
};

const saveRefreshToken = async (token: string, companyId: string) => {
  return saveToken(
    companyId,
    token,
    TokenType.REFRESH,
    Date.now() + ms(config.refreshToken.maxAge)
  );
};

const generateAndSaveRefreshToken = async (companyId: string) => {
  const token = generateOpaqueToken();
  await saveRefreshToken(token, companyId);
  return encrypt(token);
};

const findRefreshToken = async (token: string) => {
  const refreshToken = await findToken(token, TokenType.REFRESH);
  return refreshToken;
};

const generateAuthTokens = async (companyId: string) => {
  const accessToken = generateAccessToken(companyId);

  const refreshToken = await generateAndSaveRefreshToken(companyId);

  return {
    accessToken,
    refreshToken,
  };
};

const deleteCompanyRefreshTokens = (companyId: string) => {
  return prisma.token.deleteMany({
    where: {
      type: TokenType.REFRESH,
      companyId,
    },
  });
};

const saveEmailVerificationToken = (token: string, companyId: string) => {
  return saveToken(
    companyId,
    token,
    TokenType.EMAIL_VERIFICATION,
    Date.now() + ms(config.emailVerificationToken.maxAge)
  );
};

const generateAndSaveEmailVerificationToken = async (companyId: string) => {
  const token = generateOpaqueToken();
  await saveEmailVerificationToken(token, companyId);
  return encrypt(token);
};

const findEmailVerificationToken = async (token: string) => {
  const refreshToken = await findToken(token, TokenType.EMAIL_VERIFICATION);
  return refreshToken;
};

const saveResetPasswordToken = (token: string, companyId: string) => {
  return saveToken(
    companyId,
    token,
    TokenType.RESET_PASSWORD,
    Date.now() + ms(config.resetPasswordToken.maxAge)
  );
};

const generateAndSaveResetPasswordToken = async (companyId: string) => {
  const token = generateOpaqueToken();
  await saveResetPasswordToken(token, companyId);
  return encrypt(token);
};

const findResetPasswordToken = async (token: string) => {
  const refreshToken = await findToken(token, TokenType.RESET_PASSWORD);
  return refreshToken;
};

export default {
  generateAccessToken,
  generateAuthTokens,
  generateOpaqueToken,
  findRefreshToken,
  findEmailVerificationToken,
  findResetPasswordToken,
  deleteCompanyRefreshTokens,
  decodeAccessToken,
  generateAndSaveRefreshToken,
  generateAndSaveEmailVerificationToken,
  generateAndSaveResetPasswordToken,
  deleteToken,
  blacklistToken,
};
