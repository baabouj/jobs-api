import pactum from 'pactum';

import { EXCEPTION_CODE } from '../../src/exceptions';
import { prisma } from '../../src/lib';
import { tokenService } from '../../src/services';
import { exclu, only } from '../../src/utils';
import { Company, generateCompany, insertCompanies } from '../fixtures/company.fixture';
import { generateJob, insertJobs, Job } from '../fixtures/job.fixture';
import setupServer from '../utils/setup';

setupServer();
describe('Query queries', () => {
  const company = generateCompany();
  beforeAll(async () => {
    await insertCompanies([company]);
  });

  describe('QUERY me', () => {
    const meQuery = `
      query Me {
        me {
          id
          email
        }
      }
    `;
    it('should return authenticated company', async () => {
      const accessToken = tokenService.generateAccessToken(company.id);

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(meQuery)
        .withHeaders('Authorization', `Bearer ${accessToken}`)
        .expectJson({
          data: {
            me: {
              id: company.id,
              email: company.email,
            },
          },
        });
    });

    it('should error if not authenticated', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(meQuery)
        .expectJsonLike({
          errors: [
            {
              message: 'Not Authenticated',
              code: 'UNAUTHENTICATED',
            },
          ],
        });
    });
  });

  describe('QUERY job', () => {
    const jobQuery = `
      query Job($jobId: ID!) {
        job(id: $jobId) {
          id
          title
          description
          type
          applicationLink
        }
      }
    `;

    afterAll(async () => {
      await prisma.job.deleteMany();
    });

    let job: Job;
    beforeEach(() => {
      job = generateJob(company.id);
    });

    it('should successfully return job if it exists', async () => {
      await insertJobs([job]);

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(jobQuery)
        .withGraphQLVariables({
          jobId: job.id,
        })
        .expectJson({
          data: {
            job: {
              ...only(job, ['id', 'title', 'description', 'type', 'applicationLink']),
            },
          },
        });
    });

    it("should return error if job doesn't exist", async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(jobQuery)
        .withGraphQLVariables({
          jobId: job.id,
        })
        .expectJsonLike({
          errors: [
            {
              message: `Job with id '${job.id}' doesn't exist`,
              code: EXCEPTION_CODE.NOT_FOUND,
            },
          ],
        });
    });

    it('should return error if job id is not a valid uuid', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(jobQuery)
        .withGraphQLVariables({
          jobId: 'invaliduuid',
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Arguments validation failed',
              code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR,
            },
          ],
        });
    });
  });

  describe('QUERY jobs', () => {
    const jobsQuery = `
      query Jobs($limit: Int, $page: Int, $search: String) {
        jobs(limit: $limit, page: $page, search: $search) {
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
    `;

    const jobs = Array.from({ length: 5 }).map(() => generateJob(company.id));

    beforeAll(async () => {
      await insertJobs(jobs);
    });

    it('should successfully return jobs', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(jobsQuery)
        .expectJsonLike({
          data: {
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
        });
    });

    it('should successfully return paginated jobs', async () => {
      const page = 2;
      const limit = 3;
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(jobsQuery)
        .withGraphQLVariables({
          limit,
          page,
        })
        .expectJsonLike({
          data: {
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
        })
        .expect((ctx) => {
          const { data } = ctx.res.body.data.jobs;
          expect(data).toHaveLength(2);
        });
    });

    it('should successfully return limited jobs', async () => {
      const limit = 3;
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(jobsQuery)
        .withGraphQLVariables({
          limit,
        })
        .expectJsonLike({
          data: {
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
        })
        .expect((ctx) => {
          const { data } = ctx.res.body.data.jobs;
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
        .withGraphQLQuery(jobsQuery)
        .withGraphQLVariables({ search })
        .expectJsonLike({
          data: {
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
        });
    });
  });

  describe('QUERY company', () => {
    const companyQuery = `
      query Company($companyId: ID!) {
        company(id: $companyId) {
          id
          name
          email
          description
          website
          logo
          headquarter
        }
      }
    `;
    it('should successfully return company if it exists', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(companyQuery)
        .withGraphQLVariables({
          companyId: company.id,
        })
        .expectJson({
          data: {
            company: {
              ...exclu(company, ['emailVerifiedAt', 'password']),
            },
          },
        });
    });

    it("should return error if company doesn't exist", async () => {
      const { id: companyId } = generateCompany();
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(companyQuery)
        .withGraphQLVariables({
          companyId,
        })
        .expectJsonLike({
          errors: [
            {
              message: `Company with id '${companyId}' doesn't exist`,
              code: EXCEPTION_CODE.NOT_FOUND,
            },
          ],
        });
    });

    it('should return error if company id is not a valid uuid', async () => {
      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(companyQuery)
        .withGraphQLVariables({
          companyId: 'invaliduuid',
        })
        .expectJsonLike({
          errors: [
            {
              message: 'Arguments validation failed',
              code: EXCEPTION_CODE.INPUT_VALIDATION_ERROR,
            },
          ],
        });
    });
  });

  describe('QUERY companies', () => {
    const companiesQuery = `
      query Companies($page: Int, $limit: Int, $search: String) {
        companies(page: $page, limit: $limit, search: $search) {
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
            name
            email
            description
            website
            logo
            headquarter
          }
        }
      }
    `;

    beforeAll(async () => {
      await prisma.company.deleteMany();
    });

    let companies: Company[];
    beforeEach(() => {
      companies = Array.from({ length: 5 }).map(() => generateCompany());
    });

    it('should successfully return companies', async () => {
      await insertCompanies(companies);

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(companiesQuery)
        .expectJsonLike({
          data: {
            companies: {
              info: {
                total: companies.length,
                currentPage: 1,
                nextPage: null,
                prevPage: null,
                lastPage: 1,
                perPage: 20,
              },
              data: companies.map((c) => exclu(c, ['emailVerifiedAt', 'password'])),
            },
          },
        })
        .expect((ctx) => {
          const { data } = ctx.res.body.data.companies;
          expect(data).toBeDefined();
          expect(data).toHaveLength(companies.length);
        });
    });
  });
});
