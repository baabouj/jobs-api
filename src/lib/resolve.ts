/* eslint-disable no-param-reassign */
import { Schema } from 'zod';

import { Context } from '../context';
import auth from './auth';
import errorHandler from './error-handler';
import validate from './validate';

export default (fn: (parent: any, args: any, ctx: Context) => any, opts?: Options) =>
  async (parent: any, args: any, ctx: Context) => {
    try {
      if (opts?.auth) {
        await auth(ctx, opts?.verified);
      }

      if (opts?.schema) {
        args = validate(args, opts?.schema);
      }

      return await Promise.resolve(fn(parent, args, ctx));
    } catch (error: any) {
      errorHandler(error);
    }
  };

type Options = {
  schema?: Schema;
  auth?: boolean;
  verified?: boolean;
};
