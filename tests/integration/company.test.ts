import pactum from 'pactum';

import { only } from '../../src/utils';
import { generateCompany, insertCompanies } from '../fixtures/company.fixture';
import { generateJob, insertJobs } from '../fixtures/job.fixture';
import setupServer from '../utils/setup';

setupServer();
describe('Company queries', () => {
  describe('QUERY jobs', () => {
    const companyJobsQuery = `
      query Company($companyId: ID!, $page: Int, $limit: Int, $search: String) {
        company(id: $companyId) {
          jobs(page: $page, limit: $limit, search: $search) {
            info {
              total
              currentPage
              prevPage
              nextPage
              lastPage
              perPage
            }
            data {
              id
              title
              description
              type
              applicationLink
            }
          }
        }
      }
    `;

    const company = generateCompany();
    const jobs = Array.from({ length: 5 }).map(() => generateJob(company.id));

    beforeAll(async () => {
      await insertCompanies([company]);
      await insertJobs(jobs);
    });

    it('should successfully return jobs', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(companyJobsQuery)
        .withGraphQLVariables({
          companyId: company.id,
        })
        .expectJsonLike({
          data: {
            company: {
              jobs: {
                info: {
                  total: jobs.length,
                  currentPage: 1,
                  nextPage: null,
                  prevPage: null,
                  lastPage: 1,
                  perPage: 20,
                },
                data: jobs.map((job) =>
                  only(job, ['id', 'title', 'description', 'type', 'applicationLink'])
                ),
              },
            },
          },
        });
    });

    it('should successfully return paginated jobs', async () => {
      const page = 2;
      const limit = 3;
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(companyJobsQuery)
        .withGraphQLVariables({
          companyId: company.id,
          limit,
          page,
        })
        .expectJsonLike({
          data: {
            company: {
              jobs: {
                info: {
                  total: jobs.length,
                  currentPage: page,
                  nextPage: null,
                  prevPage: 1,
                  lastPage: 2,
                  perPage: limit,
                },
              },
            },
          },
        })
        .expect((ctx) => {
          const { data } = ctx.res.body.data.company.jobs;
          expect(data).toHaveLength(2);
        });
    });

    it('should successfully return limited jobs', async () => {
      const limit = 3;
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(companyJobsQuery)
        .withGraphQLVariables({
          companyId: company.id,
          limit,
        })
        .expectJsonLike({
          data: {
            company: {
              jobs: {
                info: {
                  total: jobs.length,
                  currentPage: 1,
                  nextPage: 2,
                  prevPage: null,
                  lastPage: 2,
                  perPage: limit,
                },
              },
            },
          },
        })
        .expect((ctx) => {
          const { data } = ctx.res.body.data.company.jobs;
          expect(data).toHaveLength(limit);
        });
    });

    it('should successfully return searched jobs', async () => {
      const search = jobs[3].title;
      const searchedJobs = jobs.filter(
        (job) => job.title.includes(search) || job.description.includes(search)
      );
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(companyJobsQuery)
        .withGraphQLVariables({
          companyId: company.id,
          search,
        })
        .expectJsonLike({
          data: {
            company: {
              jobs: {
                info: {
                  total: searchedJobs.length,
                  currentPage: 1,
                  nextPage: null,
                  prevPage: null,
                  lastPage: 1,
                  perPage: 20,
                },
                data: searchedJobs.map((job) =>
                  only(job, ['id', 'title', 'description', 'type', 'applicationLink'])
                ),
              },
            },
          },
        });
    });
  });
});
