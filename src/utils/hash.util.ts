import argon2 from 'argon2';

const make = async (password: string) => argon2.hash(password);
const check = (text: string, hash: string) => argon2.verify(text, hash);

export { check, make };
