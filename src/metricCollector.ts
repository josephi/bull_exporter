import bull from 'bull';
import * as Logger from 'bunyan';
import { EventEmitter } from 'events';
import IoRedis, { Redis, RedisOptions } from 'ioredis';
import { register as globalRegister, Registry } from 'prom-client';

import { logger as globalLogger } from './logger';
import { getJobCompleteStats, getStats, makeGuages, QueueGauges } from './queueGauges';

const TLS_PROTOCOL = 'rediss://';
const DEFAULT_TLS_OPTIONS = { rejectUnauthorized: false };

export interface MetricCollectorOptions extends Omit<bull.QueueOptions, 'redis'> {
  metricPrefix: string;
  redis: string;
  autoDiscover: boolean;
  logger: Logger;
  tls?: boolean;
  host?: string;
  connectionPort?: number;
  username?: string;
  password?: string;
  db?: number;
}

export interface QueueData<T = unknown> {
  queue: bull.Queue<T>;
  name: string;
  prefix: string;
}

export class MetricCollector {

  private readonly logger: Logger;

  private readonly defaultRedisClient: Redis;
  private readonly redisUri: string;
  private readonly bullOpts: Omit<bull.QueueOptions, 'redis'>;
  private readonly queuesByName: Map<string, QueueData<unknown>> = new Map();
  private readonly useConnectionString: boolean;
  private readonly redisOptions: RedisOptions;

  private get queues(): QueueData<unknown>[] {
    return [...this.queuesByName.values()];
  }

  private readonly myListeners: Set<(id: string) => Promise<void>> = new Set();

  private readonly guages: QueueGauges;

  constructor(
    queueNames: string[],
    opts: MetricCollectorOptions,
    registers: Registry[] = [globalRegister],
  ) {
    const { logger, autoDiscover, redis, metricPrefix, ...bullOpts } = opts;
    this.redisUri = redis;

    this.useConnectionString = true;
    // Add TLS options if using a rediss:// URL
    this.redisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    };
    if (typeof opts.host === 'string' && opts.host.length) {
      this.useConnectionString = false;
      this.redisOptions.host = opts.host;
      this.redisOptions.port = opts.connectionPort;
      this.redisOptions.password = opts.password;
      this.redisOptions.db = opts.db;

      if (opts.username) {
        this.redisOptions.username = opts.username;
      }

      if (opts.tls) {
        this.redisOptions.tls = DEFAULT_TLS_OPTIONS;
      }
    }
    else {
      if (this.redisUri.startsWith(TLS_PROTOCOL)) {
        this.redisOptions.tls = DEFAULT_TLS_OPTIONS;
      }
    }
    this.defaultRedisClient = this.useConnectionString ? new IoRedis(this.redisUri, this.redisOptions) : new IoRedis(this.redisOptions);
    this.defaultRedisClient.setMaxListeners(32);
    this.bullOpts = bullOpts;
    this.logger = logger || globalLogger;
    this.addToQueueSet(queueNames);
    this.guages = makeGuages(metricPrefix, registers);
  }

  private createClient(_type: 'client' | 'subscriber' | 'bclient', redisOpts?: RedisOptions): Redis {
    if (_type === 'client') {
      return this.defaultRedisClient;
    }
    // Merge any provided options with TLS settings if needed.
    const options: RedisOptions = redisOpts || {};
    if (this.redisUri.startsWith('rediss://')) {
      options.tls = { rejectUnauthorized: false };
    }
    return this.useConnectionString ? new IoRedis(this.redisUri, options) : new IoRedis(this.redisOptions);
  }

  private addToQueueSet(names: string[]): void {
    for (const name of names) {
      if (this.queuesByName.has(name)) {
        continue;
      }
      this.logger.info('added queue', name);
      this.queuesByName.set(name, {
        name,
        queue: new bull(name, {
          ...this.bullOpts,
          createClient: this.createClient.bind(this),
        }),
        prefix: this.bullOpts.prefix || 'bull',
      });
    }
  }

  public async discoverAll(): Promise<void> {
    const keyPattern = new RegExp(`^${this.bullOpts.prefix}:([^:]+):(id|failed|active|waiting|stalled-check)$`);
    this.logger.info({ pattern: keyPattern.source }, 'running queue discovery');

    const keyStream = this.defaultRedisClient.scanStream({
      match: `${this.bullOpts.prefix}:*:*`,
    });
    // tslint:disable-next-line:await-promise tslint does not like Readable's here
    for await (const keyChunk of keyStream) {
      for (const key of keyChunk) {
        const match = keyPattern.exec(key);
        if (match && match[1]) {
          this.addToQueueSet([match[1]]);
        }
      }
    }
  }

  private async onJobComplete(queue: QueueData, id: string): Promise<void> {
    try {
      const job = await queue.queue.getJob(id);
      if (!job) {
        this.logger.warn({ job: id }, 'unable to find job from id');
        return;
      }
      await getJobCompleteStats(queue.prefix, queue.name, job, this.guages);
    } catch (err) {
      this.logger.error({ err, job: id }, 'unable to fetch completed job');
    }
  }

  public collectJobCompletions(): void {
    for (const q of this.queues) {
      const cb = this.onJobComplete.bind(this, q);
      this.myListeners.add(cb);
      q.queue.on('global:completed', cb);
    }
  }

  public async updateAll(): Promise<void> {
    const updatePromises = this.queues.map(q => getStats(q.prefix, q.name, q.queue, this.guages));
    await Promise.all(updatePromises);
  }

  public async ping(): Promise<void> {
    await this.defaultRedisClient.ping();
  }

  public async close(): Promise<void> {
    this.defaultRedisClient.disconnect();
    for (const q of this.queues) {
      for (const l of this.myListeners) {
        (q.queue as any as EventEmitter).removeListener('global:completed', l);
      }
    }
    await Promise.all(this.queues.map(q => q.queue.close()));
  }

}

