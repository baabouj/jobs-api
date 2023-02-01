import { Request } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config';
import { Context } from '../context';
import { UnauthenticatedException } from '../exceptions';
import { decrypt } from '../utils';
import prisma from './prisma';

const extractToken = (req: Request) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return null;
  return decrypt(token);
};

export default async (ctx: Context, verified?: boolean) => {
  try {
    const token = extractToken(ctx.req);
    if (!token) throw new Error();

    const decoded = jwt.verify(token, config.accessToken.secret);

    const company = await prisma.company.findUnique({
      where: {
        id: decoded.sub as string,
      },
    });

    if (!company || (verified && !company.emailVerifiedAt)) throw new Error();

    ctx.company = company;
  } catch {
    throw new UnauthenticatedException();
  }
};
