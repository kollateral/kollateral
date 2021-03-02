import { resetHardhatContext } from 'hardhat/plugins-testing';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import path from 'path';

declare module 'mocha' {
	interface Context {
		hre: HardhatRuntimeEnvironment;
	}
}

export function useHardhat(): void {
	beforeEach('Loading Hardhat environment', function () {
		this.hre = require('hardhat');
	});

	afterEach('Resetting hardhat', function () {
		resetHardhatContext();
	});
}
