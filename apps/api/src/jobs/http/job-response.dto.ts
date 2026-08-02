import { ApiProperty } from '@nestjs/swagger';
import {
  JOB_STATUSES,
  URL_CHECK_STATUSES,
  type CreateJobResponse,
  type JobDetails,
  type JobListItem,
  type JobStatistics,
  type JobStatus,
  type UrlCheckResult,
  type UrlCheckStatus,
} from '@url-checker/contracts';

export class CreateJobResponseDto implements CreateJobResponse {
  @ApiProperty({
    format: 'uuid',
    example: '15ee6839-ab89-4f86-a143-b28850696a60',
  })
  jobId!: string;
}

export class JobStatisticsDto implements JobStatistics {
  @ApiProperty({ minimum: 0, example: 3 })
  success!: number;

  @ApiProperty({ minimum: 0, example: 1 })
  error!: number;
}

export class UrlCheckResultDto implements UrlCheckResult {
  @ApiProperty({
    format: 'uuid',
    example: 'a3fb4e8f-0305-4b07-a342-ec42062c64cc',
  })
  id!: string;

  @ApiProperty({ format: 'uri', example: 'https://example.com' })
  url!: string;

  @ApiProperty({
    enum: [...URL_CHECK_STATUSES],
    enumName: 'UrlCheckStatus',
    example: 'success',
  })
  status!: UrlCheckStatus;

  @ApiProperty({ type: Number, nullable: true, minimum: 100, maximum: 599, example: 200 })
  statusCode!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'HTTP or transport error; null for successful checks.',
  })
  error!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 0, example: 431 })
  durationMs!: number | null;
}

export class JobListItemDto implements JobListItem {
  @ApiProperty({
    format: 'uuid',
    example: '15ee6839-ab89-4f86-a143-b28850696a60',
  })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ enum: [...JOB_STATUSES], enumName: 'JobStatus', example: 'in_progress' })
  status!: JobStatus;

  @ApiProperty({ minimum: 1, example: 4 })
  urlCount!: number;

  @ApiProperty({ type: () => JobStatisticsDto })
  statistics!: JobStatisticsDto;
}

export class JobDetailsDto extends JobListItemDto implements JobDetails {
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ type: () => UrlCheckResultDto, isArray: true })
  results!: UrlCheckResultDto[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['urls must contain at least 1 elements'],
  })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}
