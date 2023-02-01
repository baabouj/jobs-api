import { createClient } from 'redis';

import { config } from '../config';

const client = createClient({
  url: config.redisUrl,
});

export default client;
