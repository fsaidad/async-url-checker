import { Inject, Injectable } from '@nestjs/common';

import { AppConfig } from '../../config/app-config.js';
import { ProbeError, type ProbeResponse, type UrlProbe } from '../ports/url-probe.port.js';

function errorCode(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('code' in value)) return null;
  return typeof value.code === 'string' ? value.code.toUpperCase() : null;
}

function isTimeoutError(value: unknown): boolean {
  return value instanceof Error && (value.name === 'AbortError' || value.name === 'TimeoutError');
}

function messageForErrorCode(code: string | null): string | null {
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
    case 'EAI_FAIL':
    case 'ENODATA':
      return 'DNS lookup failed';
    case 'ECONNREFUSED':
      return 'Connection refused';
    case 'ECONNRESET':
      return 'Connection reset';
    case 'ETIMEDOUT':
    case 'ESOCKETTIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'UND_ERR_HEADERS_TIMEOUT':
    case 'UND_ERR_BODY_TIMEOUT':
      return 'Request timed out';
    default:
      break;
  }

  if (
    code?.startsWith('ERR_TLS_') === true ||
    code?.startsWith('ERR_SSL_') === true ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'CERT_NOT_YET_VALID' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_GET_ISSUER_CERT' ||
    code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ) {
    return 'TLS connection failed';
  }

  return null;
}

function normalizeFetchError(error: unknown): ProbeError {
  if (error instanceof ProbeError) return error;
  const cause = error instanceof Error ? error.cause : null;
  if (isTimeoutError(error) || isTimeoutError(cause)) {
    return new ProbeError('Request timed out');
  }
  const normalizedMessage = messageForErrorCode(errorCode(cause) ?? errorCode(error));
  return new ProbeError(normalizedMessage ?? 'Network request failed');
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
