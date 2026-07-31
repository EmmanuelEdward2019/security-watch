import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'supabase/.temp']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Underscore-prefixed bindings are an intentional "deliberately discarded"
      // marker, most often when destructuring a field out of an object before a
      // write so it cannot be sent.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // Warn rather than error.
      //
      // Every occurrence in this codebase is the same shape: a `useCallback`
      // loader that opens with `setLoading(true)`, invoked from an effect on
      // mount. That costs one extra render pass, which the React Compiler is
      // right to point out — but it is the idiomatic data-fetching pattern and
      // restructuring ~20 loaders to avoid it would trade real risk for a
      // negligible gain. Kept visible so genuinely new instances get noticed
      // rather than silently accumulating.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  {
    // The router is a route manifest, not a component module: it exports a
    // configuration object alongside the lazily-imported route components. The
    // react-refresh rule is about HMR ergonomics and does not apply to it.
    files: ['src/router.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  {
    // Edge Functions run on Deno, not in the browser: no DOM globals, and the
    // Deno namespace is provided by the runtime.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        Deno: 'readonly',
      },
    },
    rules: {
      // The input sanitisers match control characters on purpose — stripping
      // them is the point.
      'no-control-regex': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
