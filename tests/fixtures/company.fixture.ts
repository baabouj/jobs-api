import { faker } from '@faker-js/faker';

import { prisma } from '../../src/lib';
import { hash } from '../../src/utils';

export type Company = {
  id: string;
  description: string;
  headquarter: string;
  logo: string;
  name: string;
  website: string;
  email: string;
  password: string;
  emailVerifiedAt: Date | null;
};

const generateCompany = (): Company => {
  return {
    id: faker.datatype.uuid(),
    description: faker.lorem.sentence(),
    headquarter: faker.address.city(),
    logo: faker.image.imageUrl(),
    name: faker.word.noun(),
    website: faker.internet.url(),
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password(),
    emailVerifiedAt: null,
  };
};

const insertCompanies = async (companies: Company[]) => {
  return Promise.all(
    companies.map(async ({ password, ...company }) => {
      const hashedPassword = await hash.make(password);
      return prisma.company.create({
        data: {
          ...company,
          password: hashedPassword,
        },
      });
    })
  );
};

export { generateCompany, insertCompanies };
