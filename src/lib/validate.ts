import { Schema } from 'zod';

import { ValidationException } from '../exceptions';

export default (data: any, schema: Schema) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const invalidArgs = result.error.errors.reduce((errors: { [key: string]: string[] }, error) => {
      const key = error.path.join('.');
      if (errors[key]) {
        errors[key].push(error.message);
      } else {
        // eslint-disable-next-line no-param-reassign
        errors[key] = [error.message];
      }
      return errors;
    }, {});
    throw new ValidationException(invalidArgs);
  }
  return result.data;
};
