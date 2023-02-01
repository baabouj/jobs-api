import { EXCEPTION_CODE } from './exception-code';
import { HttpException } from './http.exception';

export class ValidationException extends HttpException {
  constructor(invalidArgs: { [key: string]: string[] }) {
    super('Arguments validation failed', EXCEPTION_CODE.INPUT_VALIDATION_ERROR, {
      invalidArgs,
    });
  }
}
