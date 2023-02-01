import { EXCEPTION_CODE } from './exception-code';
import { HttpException } from './http.exception';

export class BadUserInputException extends HttpException {
  constructor(message: string) {
    super(message, EXCEPTION_CODE.BAD_USER_INPUT);
  }
}
