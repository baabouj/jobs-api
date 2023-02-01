import { z } from 'zod';

const paginationSchema = z.object({
  page: z
    .number()
    .nullish()
    .transform((page) => {
      return page && page > 0 ? page : 1;
    })
    .default(1),
  limit: z
    .number()
    .nullish()
    .transform((limit) => {
      return limit && limit > 0 && limit <= 100 ? limit : 20;
    })
    .default(20),
  search: z.string().nullish(),
});

type Pagination = z.infer<typeof paginationSchema>;

export { Pagination, paginationSchema };
