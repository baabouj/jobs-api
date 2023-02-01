import { randomUUID } from 'crypto';
import pino from 'pino';
import { Options } from 'pino-http';

import config from '../config';

const devOptions: Options = {
  autoLogging: false,
  quietReqLogger: true, // turn off the default logging output
  transport: {
    target: 'pino-http-print', // use the pino-http-print transport and its formatting output
    options: {
      destination: 1,
      all: true,
      translateTime: true,
    },
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    }
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    if (res.statusCode >= 300 && res.statusCode < 400) {
      return 'silent';
    }
    return 'info';
  },
  genReqId: (req) => {
    if (req.id) return req.id;

    let id = req.headers['X-Request-Id'];
    if (!id) {
      id = randomUUID();
    }

    return id;
  },
};

const prodOptions: Options = {
  autoLogging: false,

  customProps: (req: any) => ({
    request_id: randomUUID(),
    request_method: req.method,
    request_uri: req.url,
    useragent: req.headers['user-agent'],
    host_ip: req.socket.localAddress,
    source_ip: req.ip,
    protocol: req.protocol,
    port: req.socket.localPort,
  }),
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
    bindings: ({ hostname }) => ({ hostname }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: () => undefined,
    res: () => undefined,
  },
  customAttributeKeys: {
    responseTime: 'response_time',
  },
  messageKey: 'description',
  // stream: pino.destination('./combined.log'),
};

export default config.env === 'production' ? prodOptions : devOptions;
