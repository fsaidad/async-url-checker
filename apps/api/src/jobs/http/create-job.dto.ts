import { ApiProperty } from '@nestjs/swagger';
import { MAX_URLS_PER_JOB } from '@url-checker/contracts';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUrl } from 'class-validator';

export class CreateJobDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: MAX_URLS_PER_JOB,
    example: ['https://example.com', 'https://example.com/missing'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_URLS_PER_JOB)
  @IsString({ each: true })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
    { each: true },
  )
  urls!: string[];
}
