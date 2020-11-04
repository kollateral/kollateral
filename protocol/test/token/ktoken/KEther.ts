import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";

import { expect } from "chai";
import { ParamType } from "ethers/lib/utils";

function encodeExecute(type: any, abi: (string | ParamType)[], data: any[]) {
    const encodedData = ethers.utils.defaultAbiCoder.encode(abi, data);
    return ethers.utils.defaultAbiCoder.encode(["uint256", "bytes"], [type, encodedData]);
}

describe('KEther', () => {
    const noopInvokerBalance = ethers.BigNumber.from(10000);
    const kEtherUnderlyingBalance = ethers.BigNumber.from(100000);
    const platformRewardBips = ethers.BigNumber.from(5);
    const poolRewardBips = ethers.BigNumber.from(20);
    const kEtherUnderlyingBalanceRepayAmount = ethers.BigNumber.from(100250);
    const kEtherUnderlyingBalanceWithReward = ethers.BigNumber.from(100200);

    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let vault: SignerWithAddress;
    before(async () => {
        const [addr1, addr2, addr3] = await ethers.getSigners();
        owner = addr1;
        user = addr2;
        vault = addr3;
    });

    let KEther: Contract;
    let TestInvokable: Contract;

    beforeEach(async () => {
        const KEtherFactory = await ethers.getContractFactory("KEther");
        KEther = await KEtherFactory.connect(owner).deploy();
        await KEther.deployed();

        console.log("KEther ", KEther.address);

        // call admin setters
        await KEther.setPlatformReward(platformRewardBips);
        await KEther.setPoolReward(poolRewardBips);
        await KEther.setPlatformVaultAddress(vault.address);

        const TestInvokableFactory = await ethers.getContractFactory("TestInvokable");
        TestInvokable = await TestInvokableFactory.connect(owner).deploy();
        await TestInvokable.deployed();

        console.log("TestInvokable ", TestInvokable.address);

        let testInvokableTx = await user.sendTransaction({
            value: noopInvokerBalance,
            to: TestInvokable.address
        });
        await KEther.mint({ value: kEtherUnderlyingBalance });
    });

    describe('invoke', () => {

        describe('when borrowing the whole pool and successfully repaying', () => {

            const resultingPlatformReward = ethers.BigNumber.from(50);
            const resultingPoolReward = ethers.BigNumber.from(200);

            beforeEach('invoking...', async () => {
                let vaultStartingBalance = await vault.getBalance();
                const invokeTo = TestInvokable.address;
                await KEther.invoke(invokeTo, [], kEtherUnderlyingBalance);
                await KEther.underlying();
            });

            it('increments totalReserve', async () => {
                expect(await KEther.totalReserve()).to.be.equal(kEtherUnderlyingBalanceWithReward);
            });
        });
    });
});