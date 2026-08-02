import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // The assignment deliberately prescribes these small, single-use FSD slices.
      'fsd/insignificant-slice': 'off',
      // Job-oriented names are explicit vocabulary in the assignment.
      'fsd/repetitive-naming': 'off',
      // `app/providers` and `app/store` are prescribed and conventional bootstrap segments.
      'fsd/segments-by-purpose': 'off',
    },
  },
]);
