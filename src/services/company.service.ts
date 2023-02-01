import { Prisma } from '@prisma/client';

import prisma from '../lib/prisma';
import { paginate as paginateUtil } from '../utils';

const find = (id: string) => {
  return prisma.company.findUnique({
    where: {
      id,
    },
  });
};
const findByEmail = (email: string) => {
  return prisma.company.findUnique({
    where: {
      email,
    },
  });
};
const paginate = async (page: number, limit: number, search?: string | null) => {
  const where = search
    ? {
        OR: [
          {
            name: {
              contains: search,
            },
          },
          {
            description: {
              contains: search,
            },
          },
        ],
      }
    : {};

  const result = await paginateUtil('company', { page, limit }, where);

  return result;
};

const update = async (id: string, data: Prisma.CompanyUpdateInput) => {
  return prisma.company.update({
    where: {
      id,
    },
    data,
  });
};

export default {
  find,
  findByEmail,
  paginate,
  update,
};
