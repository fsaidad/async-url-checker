import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'node:url';

import { AppConfigModule } from './config/app-config.js';
import { HealthController } from './health/health.controller.js';
import { JobsModule } from './jobs/jobs.module.js';

const rootEnvFile = fileURLToPath(new URL('../../../.env', import.meta.url));

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: rootEnvFile }),
    AppConfigModule,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
