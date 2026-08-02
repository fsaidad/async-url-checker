export const DELAY_SOURCE = Symbol('DELAY_SOURCE');
export const RANDOM_SOURCE = Symbol('RANDOM_SOURCE');

export interface DelaySource {
  wait(milliseconds: number): Promise<void>;
}

export interface RandomSource {
  integer(minimum: number, maximum: number): number;
}
