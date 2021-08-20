const { readdirSync } = require('fs');
const { builtinModules } = require('module');

module.exports = {
  root: true,
  env: {
    node: true,
  },
  plugins: ['@typescript-eslint', 'simple-import-sort', 'disable'],
  parser: '@typescript-eslint/parser',
  processor: 'disable/disable',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      './tsconfig.json',
      './services/*/tsconfig.json',
      './lib/*/tsconfig.json',
    ],
    ecmaVersion: 2021,
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  settings: {
    node: {
      tryExtensions: ['.js', '.ts', '.d.ts', '.node'],
    },
  },
  overrides: [
    {
      files: ['**/*.js'],
      settings: {
        'disable/plugins': ['@typescript-eslint'],
      },
    },
    {
      files: ['**/*.ts'],
      rules: {
        'node/no-unsupported-features/es-syntax': 'off',
      },
    },
  ],
  rules: {
    'no-console': ['error'],
    'simple-import-sort/imports': [
      'warn',
      {
        groups: [
          // node builtin packages
          [`^(${builtinModules.join('|')})(/|$)`],
          // Monorepo libs
          [`^@oada/(${readdirSync('./libs').join('|')})(/.*|$)`],
          // Monorepo services
          [`^@oada/(${readdirSync('./services').join('|')})(/.*|$)`],
          // OADA/Trellis packages
          ['^(@oada|@trellisfw)(/.*|$)'],
          // Side effect imports.
          ['^\\u0000'],
          // Relative imports. Put same-folder imports and `.` last.
          [
            '^\\.\\.(?!/?$)',
            '^\\.\\./?$',
            '^\\./(?=.*/)(?!/?$)',
            '^\\.(?!/?$)',
            '^\\./?$',
          ],
        ],
      },
    ],
    'node/no-unsupported-features/es-syntax': [
      'error',
      {
        ignores: ['modules'],
      },
    ],
    'node/no-missing-require': 'off',
    'node/no-missing-import': 'off',
    'node/no-unpublished-import': 'off',
    'no-fallthrough': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        args: 'after-used',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: false,
      },
    ],
  },
};
