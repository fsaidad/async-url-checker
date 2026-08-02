import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { JobsService } from '../application/jobs.service.js';
import { CreateJobDto } from './create-job.dto.js';
import {
  ApiErrorResponseDto,
  CreateJobResponseDto,
  JobDetailsDto,
  JobListItemDto,
} from './job-response.dto.js';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create an asynchronous URL checking job' })
  @ApiBody({ type: CreateJobDto })
  @ApiAcceptedResponse({ description: 'The job was accepted', type: CreateJobResponseDto })
  @ApiBadRequestResponse({ description: 'The request body is invalid', type: ApiErrorResponseDto })
  create(@Body() body: CreateJobDto): CreateJobResponseDto {
    return this.jobs.create(body.urls);
  }

  @Get()
  @ApiOperation({ summary: 'List jobs, newest first' })
  @ApiOkResponse({ description: 'Job summaries', type: JobListItemDto, isArray: true })
  list(): JobListItemDto[] {
    return this.jobs.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job and all URL results' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Job identifier' })
  @ApiOkResponse({ description: 'Job details and URL results', type: JobDetailsDto })
  @ApiNotFoundResponse({ description: 'The job does not exist', type: ApiErrorResponseDto })
  get(@Param('id') id: string): JobDetailsDto {
    return this.jobs.get(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a job' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Job identifier' })
  @ApiOkResponse({ description: 'Current job details after cancellation', type: JobDetailsDto })
  @ApiNotFoundResponse({ description: 'The job does not exist', type: ApiErrorResponseDto })
  cancel(@Param('id') id: string): JobDetailsDto {
    return this.jobs.cancel(id);
  }
}
