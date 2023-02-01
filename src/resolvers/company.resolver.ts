import { redis, resolve } from '../lib';
import { jobService } from '../services';
import { Pagination, paginationSchema } from '../validations';

export default {
  jobs: resolve(
    async ({ id: companyId }: { id: string }, { page, limit, search }: Pagination) => {
      const key = `company_${companyId}_jobs_pagination_${page}_${limit}${
        search ? `_${search}` : ''
      }`;
      const companyJobsInCache = await redis.get(key);

      if (companyJobsInCache) {
        return JSON.parse(companyJobsInCache);
      }

      const companyJobs = await jobService.paginate(page, limit, search, companyId);

      await redis.set(key, JSON.stringify(companyJobs), {
        EX: 60 * 5,
      });

      return companyJobs;
    },
    {
      schema: paginationSchema,
    }
  ),
};
