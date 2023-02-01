import { logger } from '../config';
import { EXCEPTION_CODE, HttpException } from '../exceptions';

const errorConverter = (err: Error | HttpException): HttpException => {
  if (!(err instanceof HttpException)) {
    logger.error(err);
    return new HttpException('Internal Server Error', EXCEPTION_CODE.INTERNAL_SERVER_ERROR);
  }

  return err;
};

export default (err: Error | HttpException) => {
  const error = errorConverter(err);

  throw error;
};
