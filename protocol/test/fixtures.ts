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

	const govTokenFactory = await ethers.getContractFactory('KING');
	const KING = await govTokenFactory.deploy(admin.address, deployer.address, FIRST_SUPPLY_CHANGE);

	const multisendFactory = await ethers.getContractFactory('Multisend');
	const Multisend = await multisendFactory.deploy(KING.address);

	const sanctuaryFactory = await ethers.getContractFactory('Sanctuary');
	const Sanctuary = await sanctuaryFactory.deploy(KING.address);

	const crownFactory = await ethers.getContractFactory('Crown');
	const CrownImplementation = await crownFactory.deploy();

	const crownPrismFactory = await ethers.getContractFactory('CrownPrism');
	const CrownPrism = await crownPrismFactory.deploy(deployer.address);

	const Crown = new ethers.Contract(CrownPrism.address, CrownImplementation.interface, deployer);

	const bailiffFactory = await ethers.getContractFactory('Bailiff');
	const Bailiff = await bailiffFactory.deploy(CrownPrism.address, deployer.address);

	const treasuryFactory = await ethers.getContractFactory('Treasury');
	const Treasury = await treasuryFactory.deploy(Bailiff.address);

	return {
		govToken: KING,
		multisend: Multisend,
		sanctuary: Sanctuary,
		crownImp: CrownImplementation,
		crown: Crown,
		crownPrism: CrownPrism,
		bailiff: Bailiff,
		treasury: Treasury,
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
