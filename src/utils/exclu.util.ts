export default <T, Key extends keyof T>(obj: T, keys: Key[]): Omit<T, Key> => {
  keys.forEach((key) => {
    // eslint-disable-next-line no-param-reassign
    delete obj[key];
  });
  return obj;
};
