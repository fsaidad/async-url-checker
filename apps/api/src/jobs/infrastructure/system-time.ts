import { Injectable } from '@nestjs/common';

import type { DelaySource, RandomSource } from '../ports/time.port.js';

@Injectable()
export class SystemDelaySource implements DelaySource {
  async wait(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }
}

@Injectable()
export class MathRandomSource implements RandomSource {
  integer(minimum: number, maximum: number): number {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
  }
}
