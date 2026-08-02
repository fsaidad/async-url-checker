import { MAX_URLS_PER_JOB } from '@url-checker/contracts';

export interface ParsedUrls {
  urls: string[];
  duplicateCount: number;
  errors: string[];
}

export function parseUrls(input: string): ParsedUrls {
  const lines = input.split(/\r?\n/u).map((line, index) => ({
    line: line.trim(),
    lineNumber: index + 1,
  }));
  const urls: string[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  let duplicateCount = 0;

  for (const { line, lineNumber } of lines) {
    if (line.length === 0) continue;
    if (seen.has(line)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(line);

    try {
      const parsed = new URL(line);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push(`Line ${lineNumber}: only http:// and https:// URLs are supported.`);
      } else {
        urls.push(line);
      }
    } catch {
      errors.push(`Line ${lineNumber}: “${line}” is not a valid URL.`);
    }
  }

  if (lines.every(({ line }) => line.length === 0)) errors.push('Enter at least one URL.');
  if (urls.length > MAX_URLS_PER_JOB) {
    errors.push(`A job may contain at most ${MAX_URLS_PER_JOB} unique URLs.`);
  }
  return { urls, duplicateCount, errors };
}
