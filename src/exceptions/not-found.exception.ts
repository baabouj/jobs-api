import { EXCEPTION_CODE } from './exception-code';
import { HttpException } from './http.exception';

export class NotFoundException extends HttpException {
  constructor(message: string) {
    super(message, EXCEPTION_CODE.NOT_FOUND);
  }
}
