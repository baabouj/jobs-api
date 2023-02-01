import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-validation-complexity';
import helmet from 'helmet';
import http from 'http';
import path from 'path';

import { config, pino } from './config';
import { Context } from './context';
import resolvers from './resolvers';

const startApolloServer = async () => {
  const app = express();
  const { port } = config;

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    })
  );
  app.use(cookieParser());
  app.use(pino);
  app.use(compression());

  const httpServer = http.createServer(app);

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const typeDefs = await fs.readFile(path.join(process.cwd(), 'src/graphql/schema.gql'), 'utf8');

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    cache: 'bounded',
    introspection: config.env === 'production',
    validationRules: [depthLimit(10), createComplexityLimitRule(1000)],
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      config.env === 'production'
        ? ApolloServerPluginLandingPageProductionDefault({
            footer: false,
            includeCookies: true,
          })
        : ApolloServerPluginLandingPageLocalDefault({ includeCookies: true }),
    ],
    formatError: ({ message, extensions: { code, invalidArgs } }: any) => {
      return {
        message,
        code,
        invalidArgs,
      };
    },
  });

  await server.start();

  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: (ctx) => ctx as any,
    })
  );

  await new Promise<void>((resolve) => {
    httpServer.listen({ port }, resolve);
  });

  return server;
};

export default startApolloServer;
