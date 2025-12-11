import yargs from 'yargs';

import { version } from '../package.json';

export interface Options {
  redisUrl: string;
  redisTls: boolean;
  redisHost?: string;
  redisConnectionPort?: number;
  redisUsername?: string;
  redisPassword?: string;
  redisDb?: number;
  port: number;
  prefix: string;
  metricPrefix: string;
  once: boolean;
  bindAddress: string;
  autoDiscover: boolean;
  _: string[];
}

function buildRedisUrl(opts: Partial<Options>): string {
  if (opts.redisUrl) {
    return opts.redisUrl;
  }

  const host = opts.redisHost || '127.0.0.1';
  const port = opts.redisConnectionPort || 6379;
  const username = opts.redisUsername;
  const password = opts.redisPassword;
  const db = opts.redisDb || 0;

  let url = opts.redisTls ? 'rediss://' : 'redis://';
  if (username) {
    if (password) {
      url += `${username}:${password}@`;
    } else {
      url += `${username}@`;
    }
  } else if (password) {
    url += `:${password}@`;
  }
  url += `${host}:${port}`;
  if (db !== 0) {
    url += `/${db}`;
  }

  return url;
}

export function getOptionsFromArgs(...args: string[]): Options {
  const parsed = yargs
    .version(version)
    .alias('V', 'version')
    .env('EXPORTER_')
    .options({
      redisUrl: {
        alias: 'u',
        describe: 'A redis connection url',
        type: 'string'
      },
      redisHost: {
        describe: 'Redis host',
        type: 'string'
      },
      redisConnectionPort: {
        describe: 'Redis port',
        type: 'number'
      },
      redisUsername: {
        describe: 'Redis username (needs Redis >= 6)',
        type: 'string'
      },
      redisPassword: {
        describe: 'Redis password',
        type: 'string'
      },
      redisDb: {
        describe: 'Redis database number',
        type: 'number'
      },
      redisTls: {
        describe: 'Use TLS for Redis connection',
        type: 'boolean',
        default: false
      },
      prefix: {
        alias: 'p',
        default: 'bull',
        demandOption: true
      },
      metricPrefix: {
        alias: 'm',
        default: 'bull_queue_',
        defaultDescription: 'prefix for all exported metrics',
        demandOption: true
      },
      once: {
        alias: 'n',
        default: false,
        type: 'boolean',
        description: 'Print stats and exit without starting a server',
      },
      port: {
        default: 9538,
      },
      autoDiscover: {
        default: false,
        alias: 'a',
        type: 'boolean'
      },
      bindAddress: {
        alias: 'b',
        description: 'Address to listen on',
        default: '0.0.0.0',
      },
    }).parse(args);

  const opts = parsed as Options;
  opts.redisTls = opts.redisTls || false;
  opts.redisUrl = buildRedisUrl(opts);
  return opts;
}
