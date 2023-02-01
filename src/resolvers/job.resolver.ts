import { redis, resolve } from '../lib';
import { companyService } from '../services';

export default {
  company: resolve(async ({ companyId }) => {
    const key = `company_${companyId}`;
    const companyInCache = await redis.get(key);

    if (companyInCache) {
      // eslint-disable-next-line no-console
      console.log('Cache hit', { key });
      return JSON.parse(companyInCache);
    }

    const company = await companyService.find(companyId);

    await redis.set(key, JSON.stringify(company), {
      EX: 60 * 5,
    });

    return company;
  }),
};
