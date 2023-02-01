import { EXCEPTION_CODE } from './exception-code';
import { HttpException } from './http.exception';

export class UnauthenticatedException extends HttpException {
  constructor() {
    super('Not Authenticated', EXCEPTION_CODE.UNAUTHENTICATED);
  }
}
