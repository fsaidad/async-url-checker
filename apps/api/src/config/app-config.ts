import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppConfigValues {
  port: number;
  webOrigin: string;
  probeTimeoutMs: number;
  maxConcurrencyPerJob: number;
  maxResultDelayMs: number;
}

export const APP_CONFIG = Symbol('APP_CONFIG');
const MAX_PORT = 65_535;
// Node timers overflow above a signed 32-bit millisecond delay.
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function boundedInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function createAppConfig(config: ConfigService): AppConfigValues {
  return {
    port: boundedInteger(config.get<string>('PORT'), 3000, 'PORT', 1, MAX_PORT),
    webOrigin: config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173',
    probeTimeoutMs: boundedInteger(
      config.get<string>('PROBE_TIMEOUT_MS'),
      5_000,
      'PROBE_TIMEOUT_MS',
      1,
      MAX_TIMER_DELAY_MS,
    ),
    maxConcurrencyPerJob: boundedInteger(
      config.get<string>('MAX_CONCURRENCY_PER_JOB'),
      5,
      'MAX_CONCURRENCY_PER_JOB',
      1,
      5,
    ),
    maxResultDelayMs: boundedInteger(
      config.get<string>('MAX_RESULT_DELAY_MS'),
      10_000,
      'MAX_RESULT_DELAY_MS',
      0,
      10_000,
    ),
  };
}

@Injectable()
export class AppConfig {
  constructor(@Inject(APP_CONFIG) private readonly values: AppConfigValues) {}

  get port(): number {
    return this.values.port;
  }

  get webOrigin(): string {
    return this.values.webOrigin;
  }

  get probeTimeoutMs(): number {
    return this.values.probeTimeoutMs;
  }

  get maxConcurrencyPerJob(): number {
    return this.values.maxConcurrencyPerJob;
  }

  get maxResultDelayMs(): number {
    return this.values.maxResultDelayMs;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      inject: [ConfigService],
      useFactory: createAppConfig,
    },
    AppConfig,
  ],
  exports: [AppConfig],
})
export class AppConfigModule {}
