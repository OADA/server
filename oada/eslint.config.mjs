/**
 * @license
 * Copyright 2024 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

/* eslint-disable */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import typescript from 'typescript-eslint';

import _import from 'eslint-plugin-import';
import ava from 'eslint-plugin-ava';
import github from 'eslint-plugin-github';
import noConstructorBind from 'eslint-plugin-no-constructor-bind';
import noSecrets from 'eslint-plugin-no-secrets';
import node from 'eslint-plugin-n';
import notice from 'eslint-plugin-notice';
import optimizeRegex from 'eslint-plugin-optimize-regex';
import prettier from 'eslint-config-prettier';
import promise from 'eslint-plugin-promise';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';


const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default typescript.config(
  js.configs.recommended,
  ...typescript.configs.recommended,
  ...typescript.configs.recommendedTypeChecked,
  node.configs['flat/recommended'],
  security.configs.recommended,
  sonarjs.configs.recommended,
  unicorn.configs['flat/recommended'],
  regexp.configs['flat/recommended'],
  ...fixupConfigRules(
    compat.extends(
      'plugin:github/recommended',
      'plugin:promise/recommended',
      'plugin:optimize-regex/recommended',
      'plugin:import/recommended',
      'plugin:ava/recommended',
      'xo',
    ),
  ),
  {
    files: ['**/*.{c,m,}ts'],
    extends: [
      ...fixupConfigRules(
        compat.extends(
          // 'plugin:github/typescript',
          'plugin:import/typescript',
          // 'xo-typescript',
        ),
      ),
    ],
  },
  prettier,
  {
    ignores: [
      '**/__virtual__/',
      '**/dist/',
      '**/.test/',
      'tests',
      '.yarn/',
      '.pnp.*',
      '.history/',
      '**/.history/**',
      'coverage/',
      '.coverage/',
    ],
  },
  {
    plugins: {
      'github': fixupPluginRules(github),
      'promise': fixupPluginRules(promise),
      'optimize-regex': fixupPluginRules(optimizeRegex),
      'no-constructor-bind': noConstructorBind,
      'import': fixupPluginRules(_import),
      'no-secrets': noSecrets,
      // Sonarjs,
      'ava': fixupPluginRules(ava),
      notice,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',

      parserOptions: {
        tsconfigRootDir: __dirname,
        project: [
          './tsconfig.json',
          './libs/*/tsconfig.json',
          './libs/test/*/tsconfig.json',
          './services/*/tsconfig.json',
          './services/test/*/tsconfig.json',
        ],
      },
    },

    settings: {
      n: {
        tryExtensions: ['.js', '.ts', '.d.ts'],
      },
    },

    rules: {
      'no-void': 'off',

      '@typescript-eslint/prefer-nullish-coalescing': 'off',

      'unicorn/better-regex': 'warn',

      'notice/notice': [
        'error',
        {
          template: /* javascript */`/**
              * @license
              * Copyright <%= YEAR %> Open Ag Data Alliance
              *
              * Licensed under the Apache License, Version 2.0 (the "License");
              * you may not use this file except in compliance with the License.
              * You may obtain a copy of the License at
              *
              *        http://www.apache.org/licenses/LICENSE-2.0
              *
              * Unless required by applicable law or agreed to in writing, software
              * distributed under the License is distributed on an "AS IS" BASIS,
              * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
              * See the License for the specific language governing permissions and
              * limitations under the License.
              */`,
          onNonMatchingHeader: 'append',
          nonMatchingTolerance: 0.7,
        },
      ],

      'sonarjs/no-duplicate-string': [
        'warn',
        {
          threshold: 5,
        },
      ],

      'sonarjs/cognitive-complexity': 'warn',
      'eslint-comments/no-unused-disable': 'off',
      'node/no-unpublished-import': 'off',

      'spaced-comment': [
        'error',
        'always',
        {
          markers: ['/', '//'],
        },
      ],

      'filenames/match-regex': 'off',
      'unicorn/filename-case': 'off',
      'i18n-text/no-en': 'off',
      'eslint-comments/no-use': 'off',

      'no-secrets/no-secrets': [
        'error',
        {
          tolerance: 5,
        },
      ],

      'no-empty-label': 'off',
      'no-warning-comments': 0,
      'n/no-missing-import': 'off',
      'import/no-unresolved': 'off',
      'import/extensions': 'off',
      'unicorn/prefer-spread': 'off',

      'unicorn/prevent-abbreviations': [
        'warn',
        {
          replacements: {
            db: false,
            req: false,
            res: false,
            err: false,
            doc: false,
          },
        },
      ],

      'no-constructor-bind/no-constructor-bind': 'error',
      'no-constructor-bind/no-constructor-state': 'error',

      'sort-imports': [
        'warn',
        {
          allowSeparatedGroups: true,
        },
      ],

      'ava/no-ignored-test-files': 'off',
      'ava/no-import-test-files': 'off',
      'ava/no-skip-test': 'warn',
      'ava/no-skip-assert': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'off',

      'camelcase': 'off',

      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
        },
        {
          selector: 'import',
          modifiers: ['default'],
          format: null,
        },
        {
          selector: 'objectLiteralProperty',
          format: null,
        },
        {
          selector: 'enumMember',
          format: ['PascalCase'],
        },
        {
          selector: 'typeProperty',
          format: null,
        },
        {
          selector: 'variableLike',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          modifiers: ['destructured'],
          format: null,
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'parameter',
          modifiers: ['destructured'],
          format: null,
        },
      ],

      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-shadow': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],
      '@typescript-eslint/require-await': 'warn'
    },
  },
  {
    // Broken rules?
    rules: {
      'no-shadow': 'off',
      'no-undef': 'off',
      'no-dupe-class-members': 'off',
      'no-useless-constructor': 'off',
      'no-invalid-this': 'off',
      'filenames/match-regex': 'off',
      'i18n-text/no-en': 'off',
      'github/no-implicit-buggy-globals': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-amd': 'off',
      'import/no-commonjs': 'off',
      'import/no-mutable-exports': 'off',
      'import/no-deprecated': 'off',
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/extensions': 'off',
      'n/no-unpublished-import': 'off',
      'prettier/prettier': 'off',
    },
  },
);
