import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { expect } from "chai";
import { ParamType } from "ethers/lib/utils";

function encodeExecute(type: any, abi: (string | ParamType)[], data: any[]) {
    const encodedData = ethers.utils.defaultAbiCoder.encode(abi, data);
    return ethers.utils.defaultAbiCoder.encode(["uint256", "bytes"], [type, encodedData]);
}

describe('KErc20', function () {
    const erc20Balance = ethers.BigNumber.from(10).pow(20); // 100 TT
    const noopInvokerBalance = ethers.BigNumber.from(10000);
    const kErc20UnderlyingBalance = ethers.BigNumber.from(100000);
    const platformRewardBips = ethers.BigNumber.from(5);
    const poolRewardBips = ethers.BigNumber.from(20);
    const kErc20UnderlyingBalanceWithReward = ethers.BigNumber.from(100200);

    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let vault: SignerWithAddress;
    before(async () => {
        const [addr1, addr2, addr3] = await ethers.getSigners();
        owner = addr1;
        user = addr2;
        vault = addr3;
    });

    let kErc20: Contract;
    let TestInvokable: Contract;
    let TestToken: Contract;

    beforeEach(async function () {
        const TestInvokableFactory = await ethers.getContractFactory('TestInvokable');
        TestInvokable = await TestInvokableFactory.connect(owner).deploy();
        await TestInvokable.deployed();

        const KErc20Factory = await ethers.getContractFactory('KErc20');
        kErc20 = await KErc20Factory.connect(owner).deploy();
        await kErc20.deployed();

        await kErc20.connect(owner.address).setPlatformReward(platformRewardBips);
        await kErc20.connect(owner.address).setPoolReward(poolRewardBips);
        await kErc20.connect(owner.address).setPlatformVaultAddress(vault.address);

        const TestTokenFactory = await ethers.getContractFactory('TestToken');
        TestToken = await TestTokenFactory.connect(owner).deploy();
        await TestToken.deployed();

        await TestToken.mint(noopInvokerBalance.toString());
        await TestToken.transfer(this.invokable.address, noopInvokerBalance.toString());

        await TestToken.mint(kErc20UnderlyingBalance.toString());
        await TestToken.approve(kErc20.address, kErc20UnderlyingBalance.toString());
        await kErc20.mint(kErc20UnderlyingBalance.toString());

        await TestToken.mint(erc20Balance.toString());
    });

    describe('invoke', function () {
        describe('when borrow whole fund with successful repay', function () {

            beforeEach('invoking', async function () {
                this.vaultStartingBalance = await TestToken.balanceOf(vault.address);
                const invokeTo = this.invokable.address;
                const receipt = await kErc20.invoke(invokeTo, [], kErc20UnderlyingBalance);
                this.logs = receipt.logs;
                this.txHash = receipt.tx;
                this.underlying = await kErc20.underlying();
            });

            it('increments totalReserve', async function () {
                expect(await kErc20.totalReserve()).to.be.equal(kErc20UnderlyingBalanceWithReward);
            });

            it('emits Reward event', async function () {
                const event = kErc20.filters.Reward();
                // TODO properly test event content
                expect(event).to.be.not.null;
            });

            it('emits Invocation event', async function () {
                const event = kErc20.filters.Invokation();
                // TODO properly test event content
                expect(event).to.be.not.null;
            });

            it('emits HelperDump event', async function () {
                const event = TestInvokable.filters.HelperDump();
                // TODO properly test event content
                expect(event).to.be.not.null;
            });

            it('increments vault balance', async function () {
                expect(await TestToken.balanceOf(vault.address)).to.be.equal(this.vaultStartingBalance.add(50));
            });
        });

        describe('when forwarding value to payable invocation', function () {

            const testPayableAmount = ethers.BigNumber.from(15);

            beforeEach('invoking', async function () {
                this.vaultStartingBalance = await TestToken.balanceOf(vault.address);
                const invokeData = encodeExecute(4, ["uint256"], [testPayableAmount.toString()]);
                const invokeTo = this.invokable.address;
                const receipt = await kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance, {value: testPayableAmount});
                this.logs = receipt.logs;
                this.txHash = receipt.tx;
                this.underlying = await kErc20.underlying();
            });

            it('increments totalReserve', async function () {
                expect(await kErc20.totalReserve()).to.be.equal(kErc20UnderlyingBalanceWithReward);
            });

            it('emits Reward event', async function () {
                const event = kErc20.filters.Reward();
                // TODO properly test event content
                expect(event).to.be.not.null;
            });

            it('emits Invocation event', async function () {
                const event = kErc20.filters.Invokation();
                // TODO properly test event content
                expect(event).to.be.not.null;
            });

            it('emits HelperDump event', async function () {
                const event = TestInvokable.filters.HelperDump();
                // TODO properly test event content
                expect(event).to.be.not.null;
            });

            it('increments vault balance', async function () {
                expect(await TestToken.balanceOf(vault.address)).to.be.equal(this.vaultStartingBalance.add(50));
            });
        });

        describe('when borrow whole fund with too high repay', function () {
            const tooMuch = kErc20UnderlyingBalanceWithReward.add(1).toString();

            it('reverts', async function () {
                const invokeData = encodeExecute(1, ["uint256"], [tooMuch.toString()]);
                const invokeTo = this.invokable.address;
                await expect(kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance))
                    .to.be.revertedWith("KToken: incorrect ending balance");
            });
        });

        describe('when borrow whole fund with too low repay', function () {
            const tooLittle = kErc20UnderlyingBalanceWithReward.sub(1).toString();

            it('reverts', async function () {
                const invokeData = encodeExecute(1, ["uint256"], [tooLittle.toString()]);
                const invokeTo = this.invokable.address;
                await expect(kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance))
                    .to.be.revertedWith("KToken: incorrect ending balance");
            });
        });

        /*
         * ADMIN TESTS
         */

        describe('when setPlatformReward but not admin', function () {
            it('reverts', async function () {
                await expect(kErc20.connect(user).setPlatformReward(platformRewardBips))
                    .to.be.revertedWith("Ownable: caller is not the owner");
            });
        });

        describe('when setPoolReward but not admin', function () {
            it('reverts', async function () {
                await expect(kErc20.connect(user).setPoolReward(poolRewardBips))
                    .to.be.revertedWith("Ownable: caller is not the owner");
            });
        });

        describe('when setPlatformVaultAddress but not admin', function () {
            it('reverts', async function () {
                await expect(kErc20.connect(user).setPlatformVaultAddress(vault.address))
                    .to.be.revertedWith("Ownable: caller is not the owner");
            });
        });

        describe('when paused invoking is disabled', function () {
            beforeEach('invoking', async function () {
                await kErc20.connect(owner).pause();
            });

            it('reverts', async function () {
                const invokeTo = this.invokable.address;
                const invokeData = await this.invokable.contract.methods.execute("0x").encodeABI();
                await expect(kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance))
                    .to.be.revertedWith("Pausable: paused");
            });
        });

        /*
         *  RECURSIVE CALL TESTS
         */

        describe('when kErc20 invokes kErc20', function () {
            it('reverts', async function () {
                const invokeData = await kErc20.contract.methods
                    .invoke(this.invokable.address, "0x", kErc20UnderlyingBalance.toNumber().toString(10))
                    .encodeABI();

                await expect(kErc20.invoke(kErc20.address, invokeData, kErc20UnderlyingBalance))
                    .to.be.revertedWith("KToken: cannot invoke this contract");
            });
        });

        describe('when invokable invokes kErc20.invoke()', function () {
            it('reverts', async function () {
                // (A) Invoker: invoke -> invokable fallback(), send whole kErc20 pool
                const invokableRunInvokeData = await kErc20.contract.methods
                    .invoke(this.invokable.address, "0x", kErc20UnderlyingBalance.toNumber().toString(10))
                    .encodeABI();

                // (B) Invokable: invoke -> (A)
                const invokeData = encodeExecute(3, ["address", "bytes"], [kErc20.address, invokableRunInvokeData]);

                // (C) Invoker: invoke -> (B), send whole kErc20 pool
                const invoke = kErc20.invoke(this.invokable.address, invokeData, kErc20UnderlyingBalance);

                await expect(invoke).to.be.revertedWith("ReentrancyGuard: reentrant call");
            });
        });

        describe('when invokable invokes kErc20.mint()', function () {
            beforeEach('invoking', async function () {
                const invokeTo = TestToken.address;
                const invokeData = TestToken.contract.methods.approve(kErc20.address, ethers.BigNumber.from(1).toString()).encodeABI();
                await this.invokable.invoke(invokeTo, invokeData);
            });

            it('reverts', async function () {
                // (A) KErc20: mint
                const invokableRunInvokeAddress = kErc20.address;
                const invokableRunInvokeData =
                    await kErc20.contract.methods
                    .mint(1)
                    .encodeABI();

                // (B) Invokable: invoke -> (A)
                const invokeTo = this.invokable.address;
                const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

                // (C) Invoker: invoke -> (B), send whole kErc20 pool
                const invoke = kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

                await expect(invoke).to.be.revertedWith("ReentrancyGuard: reentrant call");
            });
        });

        describe('when invokable invokes kErc20.redeem()', function () {
            beforeEach('invoking', async function () {
                let invokeTo = TestToken.address;
                let invokeData = TestToken.contract.methods.approve(kErc20.address, ethers.BigNumber.from(1000).toString()).encodeABI();
                await this.invokable.invoke(invokeTo, invokeData);

                invokeTo = kErc20.address;
                invokeData = kErc20.contract.methods.mint(ethers.BigNumber.from(1000).toString()).encodeABI();
                await this.invokable.invoke(invokeTo, invokeData);
            });

            it('reverts', async function () {
                // (A) KEther: mint
                const invokableRunInvokeAddress = kErc20.address;
                const invokableRunInvokeData = await kErc20.contract.methods
                    .redeem(1000)
                    .encodeABI();

                // (B) Invokable: invoke -> (A)
                const invokeTo = this.invokable.address;
                const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

                // (C) Invoker: invoke -> (B), send whole kErc20 pool
                const invoke = kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

                await expect(invoke).to.be.revertedWith("ReentrancyGuard: reentrant call");
            });
        });

        describe('when invokable invokes kErc20.redeemUnderlying()', function () {
            beforeEach('invoking', async function () {
                let invokeTo = TestToken.address;
                let invokeData = TestToken.contract.methods.approve(kErc20.address, ethers.BigNumber.from(1000).toString()).encodeABI();
                await this.invokable.invoke(invokeTo, invokeData);

                invokeTo = kErc20.address;
                invokeData = kErc20.contract.methods.mint(ethers.BigNumber.from(1000).toString()).encodeABI();
                await this.invokable.invoke(invokeTo, invokeData);
            });

            it('reverts', async function () {
                // (A) KEther: redeemUnderlying
                const b = (await kErc20.balanceOfUnderlying(this.invokable.address)).toString();
                const invokableRunInvokeAddress = kErc20.address;
                const invokableRunInvokeData = await kErc20.contract.methods
                    .redeemUnderlying(1)
                    .encodeABI();

                // (B) Invokable: invoke -> (A)
                const invokeTo = this.invokable.address;
                const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

                // (C) Invoker: invoke -> (B), send whole kErc20 pool
                const invoke = kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

                await expect(invoke).to.be.revertedWith("ReentrancyGuard: reentrant call");
            });
        });
    });
});