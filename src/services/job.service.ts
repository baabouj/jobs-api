import { Prisma } from '@prisma/client';

import prisma from '../lib/prisma';
import { paginate } from '../utils';
import { Job } from '../validations';

export default {
  find: (jobId: string) => {
    return prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });
  },

  paginate: async (page: number, limit: number, search?: string | null, companyId?: string) => {
    const where = {
      companyId,
      ...(search && {
        OR: [
          {
            title: {
              contains: search,
            },
          },
          {
            description: {
              contains: search,
            },
          },
        ],
      }),
    };

    const result = await paginate('job', { page, limit }, where);

    return result;
  },

  create: (companyId: string, job: Job) => {
    return prisma.job.create({
      data: {
        companyId,
        ...job,
      },
    });
  },

  update: (jobId: string, data: Prisma.JobUpdateInput) => {
    return prisma.job.update({
      where: {
        id: jobId,
      },
      data,
    });
  },

  delete: (jobId: string) => {
    return prisma.job.delete({
      where: {
        id: jobId,
      },
    });
  },
};
