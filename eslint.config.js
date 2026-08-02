import eslint from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const webLayerPolicies = [
  {
    from: { element: { type: 'app' } },
    allow: {
      to: {
        element: { types: { anyOf: ['pages', 'widgets', 'features', 'entities', 'shared'] } },
      },
    },
  },
  {
    from: { element: { type: 'pages' } },
    allow: {
      to: { element: { types: { anyOf: ['widgets', 'features', 'entities', 'shared'] } } },
    },
  },
  {
    from: { element: { type: 'widgets' } },
    allow: { to: { element: { types: { anyOf: ['features', 'entities', 'shared'] } } } },
  },
  {
    from: { element: { type: 'features' } },
    allow: { to: { element: { types: { anyOf: ['entities', 'shared'] } } } },
  },
  {
    from: { element: { type: 'entities' } },
    allow: { to: { element: { type: 'shared' } } },
  },
  {
    from: { element: { type: 'shared' } },
    allow: { to: { element: { type: 'shared' } } },
  },
];

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'outputs/**', 'work/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: [
            'apps/api/tsconfig.json',
            'apps/web/tsconfig.json',
            'packages/contracts/tsconfig.json',
          ],
        },
      },
    },
    rules: {
      'import/no-cycle': ['error', { ignoreExternal: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'apps/web/src/app' },
        { type: 'pages', pattern: 'apps/web/src/pages/*', capture: ['slice'] },
        { type: 'widgets', pattern: 'apps/web/src/widgets/*', capture: ['slice'] },
        { type: 'features', pattern: 'apps/web/src/features/*', capture: ['slice'] },
        { type: 'entities', pattern: 'apps/web/src/entities/*', capture: ['slice'] },
        { type: 'shared', pattern: 'apps/web/src/shared/*', capture: ['segment'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: webLayerPolicies,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@app/*/*',
                '@pages/*/*',
                '@widgets/*/*',
                '@features/*/*',
                '@entities/*/*',
                '@shared/api/*',
                '@shared/config/*',
                '@shared/ui/*/*',
                '@shared/lib/*/*',
              ],
              message: 'Import the slice through its public index.ts API.',
            },
          ],
        },
      ],
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['**/*.{spec,test}.{ts,tsx}', 'apps/web/src/app/test/**/*.ts'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
);
