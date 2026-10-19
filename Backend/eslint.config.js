// ESLint flat config for the backend (CommonJS, Node 20+). Run: npm run lint
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'infra/**', 'src/modules/jurinex-voice/**/*.md', 'docs/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
      // Pre-existing style issues in legacy code — surfaced as warnings so CI stays green until they are cleaned up.
      'no-useless-escape': 'warn',
      'no-irregular-whitespace': ['warn', { skipStrings: true, skipComments: true, skipTemplates: true }],
      'no-constant-binary-expression': 'warn',
    },
  },
];
