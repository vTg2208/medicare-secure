import js from '@eslint/js';
import globals from 'globals';

import hooks from 'eslint-plugin-react-hooks';

// JSX identifiers are references too. Mark them for ESLint's core unused rule
// without bringing back a legacy React lint dependency tree.
const jsxReferences = {
  rules: { references: { create(context) { return {
    Program(node) { context.sourceCode.markVariableAsUsed('React', node); },
    JSXOpeningElement(node) {
      let name = node.name;
      while (name.type === 'JSXMemberExpression') name = name.object;
      if (name.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name)) context.sourceCode.markVariableAsUsed(name.name, node);
    },
  }; } } },
};

export default [
  { ignores: ['build/**', 'node_modules/**'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...globals.node, ...globals.vitest }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': hooks, jsx: jsxReferences },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'jsx/references': 'error',

      'react-hooks/rules-of-hooks': 'error',
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
