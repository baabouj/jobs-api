import { faker } from '@faker-js/faker';
import { JobTypes } from '@prisma/client';

import { prisma } from '../../src/lib';

export type Job = {
  id: string;
  title: string;
  description: string;
  applicationLink: string;
  type: JobTypes;
  companyId: string;
};

const generateJob = (companyId: string): Job => {
  return {
    id: faker.datatype.uuid(),
    title: faker.lorem.word(),
    description: faker.lorem.sentence(),
    applicationLink: faker.internet.url(),
    type: JobTypes.FULL_TIME,
    companyId,
  };
};

const insertJobs = (jobs: Job[]) => {
  return Promise.all(
    jobs.map((job) =>
      prisma.job.create({
        data: job,
      })
    )
  );
};

export { generateJob, insertJobs };
