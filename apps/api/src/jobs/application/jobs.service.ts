import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_URLS_PER_JOB,
  type CreateJobResponse,
  type JobDetails,
  type JobListItem,
} from '@url-checker/contracts';

import { JOBS_REPOSITORY, type JobsRepository } from '../ports/jobs-repository.port.js';
import { JobsProcessor } from './jobs-processor.js';

@Injectable()
export class JobsService {
  constructor(
    @Inject(JOBS_REPOSITORY) private readonly repository: JobsRepository,
    @Inject(JobsProcessor) private readonly processor: JobsProcessor,
  ) {}

  create(urls: readonly string[]): CreateJobResponse {
    if (urls.length === 0) {
      throw new BadRequestException('A job must contain at least one URL');
    }
    if (urls.length > MAX_URLS_PER_JOB) {
      throw new BadRequestException(`A job may contain at most ${MAX_URLS_PER_JOB} URLs`);
    }
    const job = this.repository.create(urls);
    this.processor.start(job.id);
    return { jobId: job.id };
  }

  list(): JobListItem[] {
    return this.repository.list();
  }

  get(id: string): JobDetails {
    const job = this.repository.get(id);
    if (job === null) throw new NotFoundException(`Job ${id} was not found`);
    return job;
  }

  cancel(id: string): JobDetails {
    const job = this.repository.cancel(id);
    if (job === null) throw new NotFoundException(`Job ${id} was not found`);
    return job;
  }
}
