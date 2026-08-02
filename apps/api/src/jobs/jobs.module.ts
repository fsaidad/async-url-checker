import { Module } from '@nestjs/common';

import { JobsProcessor } from './application/jobs-processor.js';
import { JobsService } from './application/jobs.service.js';
import { FetchUrlProbe } from './infrastructure/fetch-url-probe.js';
import { InMemoryJobsRepository } from './infrastructure/in-memory-jobs.repository.js';
import { MathRandomSource, SystemDelaySource } from './infrastructure/system-time.js';
import { JobsController } from './http/jobs.controller.js';
import { JOBS_REPOSITORY } from './ports/jobs-repository.port.js';
import { DELAY_SOURCE, RANDOM_SOURCE } from './ports/time.port.js';
import { URL_PROBE } from './ports/url-probe.port.js';

@Module({
  controllers: [JobsController],
  providers: [
    JobsService,
    JobsProcessor,
    InMemoryJobsRepository,
    FetchUrlProbe,
    SystemDelaySource,
    MathRandomSource,
    { provide: JOBS_REPOSITORY, useExisting: InMemoryJobsRepository },
    { provide: URL_PROBE, useExisting: FetchUrlProbe },
    { provide: DELAY_SOURCE, useExisting: SystemDelaySource },
    { provide: RANDOM_SOURCE, useExisting: MathRandomSource },
  ],
  exports: [JobsService, JobsProcessor, JOBS_REPOSITORY],
})
export class JobsModule {}
