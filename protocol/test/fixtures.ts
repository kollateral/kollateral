import { ethers, deployments, getNamedAccounts, getUnnamedAccounts } from 'hardhat';

const TOKEN_LIQUIDITY = '100000000000000000000';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const TWELVE_MONTHS_IN_SECS = 12 * 30 * 24 * 60 * 60;
const CURRENT_TIME = parseInt(String(Date.now() / 1000));
const FIRST_SUPPLY_CHANGE = CURRENT_TIME + TWELVE_MONTHS_IN_SECS;

export const governanceFixture = deployments.createFixture(async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }, options) => {
	const [deployer, lepidotteri, SHA_2048, feeCollector, King, Bishop, Jester, Dragon, Peasant] = await ethers.getSigners();

	const admin = lepidotteri;
	const liquidityProvider = King;

	const govTokenFactory = await ethers.getContractFactory('CrownGovernanceToken');
	const CrownGovernanceToken = await govTokenFactory.deploy(admin.address, deployer.address, FIRST_SUPPLY_CHANGE);

	const multisendFactory = await ethers.getContractFactory('Multisend');
	const Multisend = await multisendFactory.deploy(CrownGovernanceToken.address);

	const vestingFactory = await ethers.getContractFactory('Vesting');
	const Vesting = await vestingFactory.deploy(CrownGovernanceToken.address);

	const votingPowerFactory = await ethers.getContractFactory('VotingPower');
	const VotingPowerImplementation = await votingPowerFactory.deploy();

	const votingPowerPrismFactory = await ethers.getContractFactory('VotingPowerPrism');
	const VotingPowerPrism = await votingPowerPrismFactory.deploy(deployer.address);

	const VotingPower = new ethers.Contract(VotingPowerPrism.address, VotingPowerImplementation.interface, deployer);

	const lockManagerFactory = await ethers.getContractFactory('LockManager');
	const LockManager = await lockManagerFactory.deploy(VotingPowerPrism.address, deployer.address);

	const vaultFactory = await ethers.getContractFactory('Vault');
	const Vault = await vaultFactory.deploy(LockManager.address);

	return {
		govToken: CrownGovernanceToken,
		multisend: Multisend,
		vesting: Vesting,
		votingPower: VotingPower,
		votingPowerImplementation: VotingPowerImplementation,
		votingPowerPrism: VotingPowerPrism,
		lockManager: LockManager,
		vault: Vault,
		deployer: deployer,
		lepidotteri: lepidotteri,
		SHA_2048: SHA_2048,
		feeCollector: feeCollector,
		King: King,
		Jester: Jester,
		Bishop: Bishop,
		Dragon: Dragon,
		Peasant: Peasant,
		admin: admin,
		liquidityProvider: liquidityProvider,
		ZERO_ADDRESS: ZERO_ADDRESS,
	};
});
