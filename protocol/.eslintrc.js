module.exports = {
	root: false,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 'esnext', // Allows for the parsing of modern ECMAScript features
		sourceType: 'module', // Allows for the use of imports
	},
	env: {
		commonjs: true,
	},
	plugins: ['@typescript-eslint'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
	rules: {
		'@typescript-eslint/ban-ts-comment': 0,
		'@typescript-eslint/no-unused-vars': 0,
		'@typescript-eslint/no-explicit-any': 0,
	},
};
