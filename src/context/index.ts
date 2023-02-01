import { Company } from '@prisma/client';
import { Request, Response } from 'express';

export type Context = {
  req: Request;
  res: Response;
  company: Company;
};
