import { Inject, Injectable } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.js';
import { ProbeError, type ProbeResponse, type UrlProbe } from '../ports/url-probe.port.js';

function normalizeFetchError(error: unknown): ProbeError {
  if (error instanceof ProbeError) return error;
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return new ProbeError('Request timed out');
    }
    const causeMessage = error.cause instanceof Error ? error.cause.message.trim() : '';
    return new ProbeError(causeMessage || error.message || 'Network request failed');
  }
  return new ProbeError('Network request failed');
}

@Injectable()
export class FetchUrlProbe implements UrlProbe {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  async head(url: string): Promise<ProbeResponse> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ProbeError('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ProbeError('Only http and https URLs are supported');
    }

    try {
      const response = await fetch(parsed, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(this.config.probeTimeoutMs),
        headers: { 'user-agent': 'async-url-checker/1.0' },
      });
      return { statusCode: response.status, statusText: response.statusText };
    } catch (error: unknown) {
      throw normalizeFetchError(error);
    }
  }
}
