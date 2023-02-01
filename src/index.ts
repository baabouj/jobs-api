import { ApolloServer } from '@apollo/server';
import { Prisma } from '@prisma/client';

import { config, logger, transport } from './config';
import { Context } from './context';
import { prisma, redis } from './lib';
import startApolloServer from './server';

let server: ApolloServer<Context>;

const exitHandler = async () => {
  if (server) {
    await server.stop();
  }

  logger.info('Server closed');

  // wait until all async writes are completed
  setTimeout(() => {
    process.exit(1);
  }, 3000);
};

const main = async () => {
  await prisma.$connect();
  logger.info('Connected to Database');

  redis.on('error', () => {
    throw new Error('Failed to connect to Redis');
  });

  await redis.connect();
  logger.info('Connected to Redis');

  await transport.verify();
  logger.info('Connected to email server');

  server = await startApolloServer();
  logger.info(`Server listening on port ${config.port}`);
};

main();

// prisma.$connect().then(async () => {
//   logger.info('Connected to Database');

//   redis.on('error', () => {
//     logger.error('Failed to connect to Redis');
//   });

//   redis.connect().then(() => {
//     logger.info('Connected to Redis');

//     transport
//       .verify()
//       .then(async () => {
//         logger.info('Connected to email server');

//         server = await startApolloServer();
//         logger.info(`Server listening on port ${config.port}`);
//       })
//       .catch(() => {
//         logger.error('Failed to connect to email server');
//       });
//   });
// });

const unexpectedErrorHandler = async (error: any) => {
  if (error instanceof Prisma.PrismaClientInitializationError && error.errorCode) {
    logger.fatal('Failed to connect to Database');
  } else {
    logger.fatal({
      message: error.message,
      stack: error.stack,
    });
  }

  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.fatal('SIGTERM received');
  if (server) {
    server.stop().then(() => {
      logger.info('Server closed');
    });
  }
});
