import { Context } from '../context';
import { NotFoundException } from '../exceptions';
import { redis, resolve } from '../lib';
import { companyService, jobService } from '../services';
import { Pagination, paginationSchema } from '../validations';
import { UuidArg, uuidArgSchema } from '../validations/uuid.validation';

export default {
  jobs: resolve(
    async (_parent, { page, limit, search }: Pagination) => {
      const key = `jobs_pagination_${page}_${limit}${search ? `_${search}` : ''}`;
      const jobsInCache = await redis.get(key);

      if (jobsInCache) {
        return JSON.parse(jobsInCache);
      }

      const jobs = await jobService.paginate(page, limit, search);

      await redis.set(key, JSON.stringify(jobs), {
        EX: 60 * 5,
      });

      return jobs;
    },
    {
      schema: paginationSchema,
    }
  ),
  job: resolve(
    async (_parent, { id }: UuidArg) => {
      const key = `job_${id}`;
      const jobInCache = await redis.get(key);

      if (jobInCache) {
        return JSON.parse(jobInCache);
      }

      const job = await jobService.find(id);

      if (!job) throw new NotFoundException(`Job with id '${id}' doesn't exist`);

      await redis.set(key, JSON.stringify(job), {
        EX: 60 * 5,
      });

      return job;
    },
    {
      schema: uuidArgSchema,
    }
  ),
  companies: resolve(
    async (_parent, { page, limit, search }: Pagination) => {
      const key = `companies_pagination_${page}_${limit}${search ? `_${search}` : ''}`;
      const companiesInCache = await redis.get(key);

      if (companiesInCache) {
        return JSON.parse(companiesInCache);
      }

      const companies = await companyService.paginate(page, limit, search);

      await redis.set(key, JSON.stringify(companies), {
        EX: 60 * 5,
      });

      return companies;
    },
    {
      schema: paginationSchema,
    }
  ),
  company: resolve(
    async (_parent, { id }: UuidArg) => {
      const key = `company_${id}`;
      const companyInCache = await redis.get(key);

      // const keys = [...(await redis.keys(`jobs_*`)), ...(await redis.keys(`${key}_jobs_*`))];
      // const keys = await redis.keys(`jobs_*`);
      // await redis.del(keys);

      // eslint-disable-next-line no-console
      // console.log({ keys });

      if (companyInCache) {
        return JSON.parse(companyInCache);
      }

      const company = await companyService.find(id);

      if (!company) throw new NotFoundException(`Company with id '${id}' doesn't exist`);

      await redis.set(key, JSON.stringify(company), {
        EX: 60 * 5,
      });

      return company;
    },
    {
      schema: uuidArgSchema,
    }
  ),
  me: resolve(
    (_parent, _args, { company }: Context) => {
      return company;
    },
    {
      auth: true,
    }
  ),
};
