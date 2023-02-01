import { EXCEPTION_CODE } from './exception-code';
import { HttpException } from './http.exception';

export class ForbiddenException extends HttpException {
  constructor() {
    super('Not Authorized', EXCEPTION_CODE.FORBIDDEN);
  }
}
