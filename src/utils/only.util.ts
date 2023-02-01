export default <T, Key extends keyof T>(object: T, keys: Key[]): Partial<Pick<T, Key>> =>
  keys.reduce((obj: any, key) => {
    // eslint-disable-next-line no-param-reassign
    obj[key] = object[key];
    return obj;
  }, {});
