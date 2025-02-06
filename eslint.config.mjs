import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import neostandard from 'neostandard'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...neostandard({semi: true}), {
    languageOptions: {
        globals: {
            ...globals.browser,
            _: true,
            $: true,
        },

        ecmaVersion: 2020,
        sourceType: "module",

        parserOptions: {
            ecmaFeatures: {
                modules: true,
                impliedStrict: true,
            },
        },
    },

    rules: {
        '@stylistic/indent': ["error", 4, {
            SwitchCase: 1,
        }],

     //   semi: ["error", "always"],
        "one-var": "off",
        "@stylistic/space-before-function-paren": "off",
        "no-throw-literal": "off",

        camelcase: ["error", {
            properties: "always",
        }],

        "no-console": "error",
        "no-alert": "error",
        "no-debugger": "error",
        "prefer-arrow-callback": "error",
        "@stylistic/object-property-newline": "off",
        "no-useless-escape": "off",
        "no-var": "error",
        "prefer-const": "error",
        "no-unused-expressions": "error",
        strict: ["error", "never"],
        "@stylistic/no-mixed-operators": "off",
        "prefer-promise-reject-errors": "off",
        "standard/no-callback-literal": "off",
        "import/no-webpack-loader-syntax": "off",
        "@stylistic/object-curly-spacing": "off",
        "@stylistic/object-curly-newline": "off",
        "@stylistic/quote-props": "off",
        "no-case-declarations": "off",
        "dot-notation": "off",
        "no-prototype-builtins": "off",
        "@stylistic/multiline-ternary": "off",
        "node/no-callback-literal": "off",
        "n/no-callback-literal": "off",
        "object-shorthand": "off",
        "import-x/no-webpack-loader-syntax": "off",
    },
}];
