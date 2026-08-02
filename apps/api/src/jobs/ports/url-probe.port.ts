export const URL_PROBE = Symbol('URL_PROBE');

export interface ProbeResponse {
  statusCode: number;
  statusText: string;
}

export interface UrlProbe {
  head(url: string): Promise<ProbeResponse>;
}

export class ProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProbeError';
  }
}
