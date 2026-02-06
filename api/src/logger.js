import pino from 'pino';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
  transport: !IS_PRODUCTION
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  redact: ['req.headers.authorization', 'req.body.password', 'req.body.p_device_token_hash'],
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
