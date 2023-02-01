import { ApolloServer } from '@apollo/server';
import pactum from 'pactum';

import { Context } from '../../src/context';
import { prisma, redis } from '../../src/lib';
import startApolloServer from '../../src/server';

let server: ApolloServer<Context>;

const setupServer = () => {
  beforeAll(async () => {
    await prisma.$connect();
    await redis.connect();
    server = await startApolloServer();

    pactum.request.setBaseUrl('http://localhost:4000/graphql');
  });

  afterAll(async () => {
    await server.stop();
    await prisma.$transaction([
      prisma.token.deleteMany(),
      prisma.job.deleteMany(),
      prisma.company.deleteMany(),
    ]);
    await prisma.$disconnect();
    await redis.disconnect();
  });
};

export default setupServer;
