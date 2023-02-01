import { Company, Job, Prisma } from '@prisma/client';

import { prisma } from '../lib';
import { Pagination } from '../validations';

const paginate = async <T extends 'job' | 'company'>(
  model: T,
  { page, limit }: Pagination,
  where: T extends 'job' ? Prisma.JobWhereInput : Prisma.CompanyWhereInput
): Promise<{
  info: {
    total: number;
    currentPage: number;
    nextPage: number | null;
    prevPage: number | null;
    lastPage: number;
    perPage: number;
  };
  data: T extends 'job' ? Job[] : Company[];
}> => {
  const prismaModel = prisma[model] as any;

  const [data, total] = await prisma.$transaction([
    prismaModel.findMany({
      where,
      take: limit,
      skip: limit * (page - 1),
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prismaModel.count({
      where,
    }),
  ]);

  const lastPage = Math.ceil(total / limit);
  const info = {
    total,
    currentPage: page,
    nextPage: page + 1 > lastPage ? null : page + 1,
    prevPage: page - 1 <= 0 ? null : page - 1,
    lastPage,
    perPage: limit,
  };

  return { info, data };
};

export default paginate;
