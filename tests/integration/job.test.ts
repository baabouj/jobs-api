import pactum from 'pactum';

import { exclu } from '../../src/utils';
import { generateCompany, insertCompanies } from '../fixtures/company.fixture';
import { generateJob, insertJobs } from '../fixtures/job.fixture';
import setupServer from '../utils/setup';

setupServer();
describe('Job queries', () => {
  describe('QUERY company', () => {
    const jobCompanyQuery = `
      query JobCompany($jobId: ID!) {
        job(id: $jobId) {
          company {
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

    it("should successfully return job's company", async () => {
      const [company] = await insertCompanies([generateCompany()]);
      const [{ id: jobId }] = await insertJobs([generateJob(company.id)]);

      await pactum
        .spec()
        .post('/')
        .withGraphQLQuery(jobCompanyQuery)
        .withGraphQLVariables({
          jobId,
        })
        .expectJsonLike({
          data: {
            job: {
              company: {
                ...exclu(company, ['emailVerifiedAt', 'password', 'createdAt', 'updatedAt']),
              },
            },
          },
        });
    });
  });
});
