import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import { HealthController } from './health/health.controller.js';
import { JobsService } from './jobs/application/jobs.service.js';
import { JobsController } from './jobs/http/jobs.controller.js';

describe('OpenAPI document', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController, JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: {
            create: vi.fn(),
            list: vi.fn(),
            get: vi.fn(),
            cancel: vi.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Async URL Checker API').setVersion('1.0').build(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('references concrete response schemas for every successful endpoint', () => {
    expect(document.paths['/api/health']?.get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/HealthResponseDto' },
        },
      },
    });
    expect(document.paths['/api/jobs']?.post?.responses['202']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateJobResponseDto' },
        },
      },
    });
    expect(document.paths['/api/jobs']?.get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/JobListItemDto' },
          },
        },
      },
    });
    expect(document.paths['/api/jobs/{id}']?.get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/JobDetailsDto' },
        },
      },
    });
    expect(document.paths['/api/jobs/{id}']?.delete?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/JobDetailsDto' },
        },
      },
    });
  });

  it('documents validation and not-found responses', () => {
    expect(document.paths['/api/jobs']?.post?.responses['400']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponseDto' },
        },
      },
    });
    expect(document.paths['/api/jobs/{id}']?.get?.responses['404']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponseDto' },
        },
      },
    });
    expect(document.paths['/api/jobs/{id}']?.delete?.responses['404']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponseDto' },
        },
      },
    });
  });

  it('contains nested result/statistics models and shared status enums', () => {
    const schemas = document.components?.schemas;

    expect(schemas?.JobStatus).toMatchObject({
      type: 'string',
      enum: ['pending', 'in_progress', 'completed', 'cancelled', 'failed'],
    });
    expect(schemas?.UrlCheckStatus).toMatchObject({
      type: 'string',
      enum: ['pending', 'in_progress', 'success', 'error', 'cancelled'],
    });
    expect(schemas?.JobListItemDto).toMatchObject({
      properties: {
        status: { allOf: [{ $ref: '#/components/schemas/JobStatus' }] },
        statistics: { $ref: '#/components/schemas/JobStatisticsDto' },
      },
    });
    expect(schemas?.JobDetailsDto).toMatchObject({
      properties: {
        results: {
          type: 'array',
          items: { $ref: '#/components/schemas/UrlCheckResultDto' },
        },
      },
    });
    expect(schemas?.UrlCheckResultDto).toMatchObject({
      properties: {
        status: { allOf: [{ $ref: '#/components/schemas/UrlCheckStatus' }] },
        statusCode: { type: 'number', nullable: true },
        error: { type: 'string', nullable: true },
        durationMs: { type: 'number', nullable: true, minimum: 0 },
      },
    });
  });
});
