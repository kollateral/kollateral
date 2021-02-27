import chalk from 'chalk';

export function getEnv(key: string): string | undefined {
	const variable = process.env[key];
	if (variable === undefined) {
		return undefined;
	}
	return variable.trim();
}

export function printWarning(env: string): void {
	console.warn(chalk.bold.yellowBright.bgBlackBright(`TEST RUN INCOMPLETE: Set the env variable ${env} in /protocol/.env`));
}
