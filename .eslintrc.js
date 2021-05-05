/**@type {import('eslint').Linter.Config} */
/* eslint indent: ["error", "tab"] */

// eslint-disable-next-line no-undef
module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	],
	rules: {
		'semi': [2, 'always'],
		'@typescript-eslint/no-unused-vars': 0,
		'@typescript-eslint/no-explicit-any': 0,
		'@typescript-eslint/explicit-module-boundary-types': 0,
		'@typescript-eslint/no-non-null-assertion': 0,
	},

	'overrides': [
		{
			files: [
				'client/src/test/*.test.ts',
				'server/src/*.ts',
			],
			extends: [
				'plugin:@typescript-eslint/eslint-recommended',
				'prettier',
				'plugin:prettier/recommended',
			],
			rules: {
				'camelcase': [2, {'properties': 'always'}],
				'sort-imports': [2, {
					'ignoreCase': false,
					'allowSeparatedGroups': true,
				}],
			}
		}
	]
};
