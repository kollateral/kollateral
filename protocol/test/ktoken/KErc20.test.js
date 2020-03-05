const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ethers } = require("ethers");

const TestInvokable = contract.fromArtifact('TestInvokable');
const KErc20 = contract.fromArtifact('KErc20');
const TestToken = contract.fromArtifact('TestToken');

function encodeExecute(testType, dataAbi, data) {
  const encodedData = ethers.utils.defaultAbiCoder.encode(dataAbi, data);
  return ethers.utils.defaultAbiCoder.encode(["uint256", "bytes"], [testType, encodedData]);
}

describe('KErc20', function () {
  const [ ownerAddress, userAddress, vaultAddress ] = accounts;
  const erc20Balance = new BN(10).pow(new BN(20)); // 100 TT
  const noopInvokerBalance = new BN(10000);
  const kErc20UnderlyingBalance = new BN(100000);
  const platformRewardBips = new BN(5);
  const poolRewardBips = new BN(20);
  const kErc20UnderlyingBalanceRepayAmount = new BN(100250);
  const kErc20UnderlyingBalanceWithReward = new BN(100200);

  beforeEach(async function () {
    this.erc20 = await TestToken.new("Test Token", "TT", 18, {from: ownerAddress});
    this.kErc20 = await KErc20.new(this.erc20.address, "Kollateral TT", "kTT", 18, {from: ownerAddress});
    
    await this.kErc20.setPlatformReward(platformRewardBips, {from: ownerAddress});
    await this.kErc20.setPoolReward(poolRewardBips, {from: ownerAddress});
    await this.kErc20.setPlatformVaultAddress(vaultAddress, {from: ownerAddress});

    this.invokable = await TestInvokable.new({from: ownerAddress});
    await this.erc20.mint(noopInvokerBalance.toString());
    await this.erc20.transfer(this.invokable.address, noopInvokerBalance.toString());

    await this.erc20.mint(kErc20UnderlyingBalance.toString());
    await this.erc20.approve(this.kErc20.address, kErc20UnderlyingBalance.toString());
    await this.kErc20.mint(kErc20UnderlyingBalance.toString());

    await this.erc20.mint(erc20Balance.toString());
  });

  describe('invoke', function () {
    describe('when borrow whole fund with successful repay', function () {

      const resultingPlatformReward = new BN(50);
      const resultingPoolReward = new BN(200);

      beforeEach('invoking', async function () {
        this.vaultStartingBalance = await this.erc20.balanceOf(vaultAddress);
        const invokeTo = this.invokable.address;
        const receipt = await this.kErc20.invoke(invokeTo, [], kErc20UnderlyingBalance);
        this.logs = receipt.logs;
        this.txHash = receipt.tx;
        this.underlying = await this.kErc20.underlying();
      });

      it('increments totalReserve', async function () {
        expect(await this.kErc20.totalReserve()).to.be.bignumber.equal(kErc20UnderlyingBalanceWithReward);
      });

      it('emits Reward event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Reward', {
          tokenAddress: this.underlying
        });

        expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
        expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
      });

      it('emits Invocation event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Invocation', {
          invokeTo: this.invokable.address
        });

        expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
        expect(event.args.underlyingAmount).to.be.bignumber.equal(kErc20UnderlyingBalance);
      });

      it('emits HelperDump event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
          currentTokenAddress: this.underlying,
          isCurrentTokenEther: false
        });

        expect(event.args.currentTokenAmount).to.be.bignumber.equal(kErc20UnderlyingBalance);
        expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(kErc20UnderlyingBalanceRepayAmount);
      });

      it('increments vault balance', async function () {
        expect(await this.erc20.balanceOf(vaultAddress)).to.be.bignumber.equal(this.vaultStartingBalance.addn(50));
      });
    });

    describe('when forwarding value to payable invocation', function () {

      const resultingPlatformReward = new BN(50);
      const resultingPoolReward = new BN(200);
      const testPayableAmount = new BN(15);

      beforeEach('invoking', async function () {
        this.vaultStartingBalance = await this.erc20.balanceOf(vaultAddress);
        const invokeData = encodeExecute(4, ["uint256"], [testPayableAmount.toString()]);
        const invokeTo = this.invokable.address;
        const receipt = await this.kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance, {value: testPayableAmount});
        this.logs = receipt.logs;
        this.txHash = receipt.tx;
        this.underlying = await this.kErc20.underlying();
      });

      it('increments totalReserve', async function () {
        expect(await this.kErc20.totalReserve()).to.be.bignumber.equal(kErc20UnderlyingBalanceWithReward);
      });

      it('emits Reward event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Reward', {
          tokenAddress: this.underlying
        });

        expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
        expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
      });

      it('emits Invocation event', async function () {
        const event = expectEvent.inLogs(this.logs, 'Invocation', {
          invokeTo: this.invokable.address
        });

        expect(event.args.invokeValue).to.be.bignumber.equal(testPayableAmount);
        expect(event.args.underlyingAmount).to.be.bignumber.equal(kErc20UnderlyingBalance);
      });

      it('emits HelperDump event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
          currentTokenAddress: this.underlying,
          isCurrentTokenEther: false
        });

        expect(event.args.currentTokenAmount).to.be.bignumber.equal(kErc20UnderlyingBalance);
        expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(kErc20UnderlyingBalanceRepayAmount);
      });

      it('increments vault balance', async function () {
        expect(await this.erc20.balanceOf(vaultAddress)).to.be.bignumber.equal(this.vaultStartingBalance.addn(50));
      });
    });

    describe('when borrow whole fund with too high repay', function () {
      const tooMuch = kErc20UnderlyingBalanceWithReward.addn(1).toString();

      it('reverts', async function () {
        const invokeData = encodeExecute(1, ["uint256"], [tooMuch.toString()]);
        const invokeTo = this.invokable.address;
        await expectRevert(
          this.kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance),
          "KToken: incorrect ending balance");
      });
    });

    describe('when borrow whole fund with too low repay', function () {
      const tooLittle = kErc20UnderlyingBalanceWithReward.subn(1).toString();

      it('reverts', async function () {
        const invokeData = encodeExecute(1, ["uint256"], [tooLittle.toString()]);
        const invokeTo = this.invokable.address;
        await expectRevert(
          this.kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance),
          "KToken: incorrect ending balance");
      });
    });

    /*
     * ADMIN TESTS
     */

    describe('when setPlatformReward but not admin', function () {
      it('reverts', async function () {
        await expectRevert(
          this.kErc20.setPlatformReward(platformRewardBips, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when setPoolReward but not admin', function () {
      it('reverts', async function () {
        await expectRevert(
          this.kErc20.setPoolReward(poolRewardBips, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when setPlatformVaultAddress but not admin', function () {
      it('reverts', async function () {
        await expectRevert(
          this.kErc20.setPlatformVaultAddress(vaultAddress, {from: userAddress}),
          "Ownable: caller is not the owner");
      });
    });

    describe('when paused invoking is disabled', function () {
      beforeEach('invoking', async function () {
        await this.kErc20.pause({from: ownerAddress});
      });

      it('reverts', async function () {
        const invokeTo = this.invokable.address;
        const invokeData = await this.invokable.contract.methods.execute("0x").encodeABI();
        await expectRevert(
          this.kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance),
          "Pausable: paused");
      });
    });

    /*
     *  RECURSIVE CALL TESTS
     */

    describe('when kErc20 invokes kErc20', function () {
      it('reverts', async function () {
        const invokeData = await this.kErc20.contract.methods
          .invoke(this.invokable.address, "0x", kErc20UnderlyingBalance.toString(10))
          .encodeABI();

        await expectRevert(
          this.kErc20.invoke(this.kErc20.address, invokeData, kErc20UnderlyingBalance),
          "KToken: cannot invoke this contract");
      });
    });

    describe('when invokable invokes kErc20.invoke()', function () {
      it('reverts', async function () {
        // (A) Invoker: invoke -> invokable fallback(), send whole kErc20 pool
        const invokableRunInvokeData = await this.kErc20.contract.methods
          .invoke(this.invokable.address, "0x", kErc20UnderlyingBalance.toString(10))
          .encodeABI();

        // (B) Invokable: invoke -> (A)
        const invokeData = encodeExecute(3, ["address", "bytes"], [this.kErc20.address, invokableRunInvokeData]);

        // (C) Invoker: invoke -> (B), send whole kErc20 pool
        const invoke = this.kErc20.invoke(this.invokable.address, invokeData, kErc20UnderlyingBalance);

        await expectRevert(invoke, "ReentrancyGuard: reentrant call");
      });
    });

    describe('when invokable invokes kErc20.mint()', function () {
      beforeEach('invoking', async function () {
        const invokeTo = this.erc20.address;
        const invokeData = this.erc20.contract.methods.approve(this.kErc20.address, new BN(1).toString()).encodeABI();
        await this.invokable.invoke(invokeTo, invokeData);
      });

      it('reverts', async function () {
        // (A) KErc20: mint
        const invokableRunInvokeAddress = await this.kErc20.address;
        const invokableRunInvokeData = await this.kErc20.contract.methods
          .mint(1)
          .encodeABI();

        // (B) Invokable: invoke -> (A)
        const invokeTo = this.invokable.address;
        const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

        // (C) Invoker: invoke -> (B), send whole kErc20 pool
        const invoke = this.kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

        await expectRevert(invoke, "ReentrancyGuard: reentrant call");
      });
    });

    describe('when invokable invokes kErc20.redeem()', function () {
      beforeEach('invoking', async function () {
        let invokeTo = this.erc20.address;
        let invokeData = this.erc20.contract.methods.approve(this.kErc20.address, new BN(1000).toString()).encodeABI();
        await this.invokable.invoke(invokeTo, invokeData);

        invokeTo = this.kErc20.address;
        invokeData = this.kErc20.contract.methods.mint(new BN(1000).toString()).encodeABI();
        await this.invokable.invoke(invokeTo, invokeData);
      });

      it('reverts', async function () {
        // (A) KEther: mint
        const invokableRunInvokeAddress = await this.kErc20.address;
        const invokableRunInvokeData = await this.kErc20.contract.methods
          .redeem(1000)
          .encodeABI();

        // (B) Invokable: invoke -> (A)
        const invokeTo = this.invokable.address;
        const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

        // (C) Invoker: invoke -> (B), send whole kErc20 pool
        const invoke = this.kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

        await expectRevert(invoke, "ReentrancyGuard: reentrant call");
      });
    });

    describe('when invokable invokes kErc20.redeemUnderlying()', function () {
      beforeEach('invoking', async function () {
        let invokeTo = this.erc20.address;
        let invokeData = this.erc20.contract.methods.approve(this.kErc20.address, new BN(1000).toString()).encodeABI();
        await this.invokable.invoke(invokeTo, invokeData);

        invokeTo = this.kErc20.address;
        invokeData = this.kErc20.contract.methods.mint(new BN(1000).toString()).encodeABI();
        await this.invokable.invoke(invokeTo, invokeData);
      });

      it('reverts', async function () {
        // (A) KEther: redeemUnderlying
        const b = (await this.kErc20.balanceOfUnderlying(this.invokable.address)).toString();
        const invokableRunInvokeAddress = await this.kErc20.address;
        const invokableRunInvokeData = await this.kErc20.contract.methods
          .redeemUnderlying(1)
          .encodeABI();

        // (B) Invokable: invoke -> (A)
        const invokeTo = this.invokable.address;
        const invokeData = encodeExecute(3, ["address", "bytes"], [invokableRunInvokeAddress, invokableRunInvokeData]);

        // (C) Invoker: invoke -> (B), send whole kErc20 pool
        const invoke = this.kErc20.invoke(invokeTo, invokeData, kErc20UnderlyingBalance);

        await expectRevert(invoke, "ReentrancyGuard: reentrant call");
      });
    });
  });
});