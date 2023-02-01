import { GraphQLError } from 'graphql';

import { ExceptionCode } from './exception-code';

export class HttpException extends GraphQLError {
  constructor(message: string, code: ExceptionCode, extensions?: Record<string, any>) {
    super(message, {
      extensions: {
        code,
        ...extensions,
      },
    });
  }
}
