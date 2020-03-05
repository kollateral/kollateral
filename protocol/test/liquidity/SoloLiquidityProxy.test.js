const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ethers } = require('ethers');

const ETHER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
const OTHER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000002";


const Invoker = contract.fromArtifact('Invoker');
const KollateralLiquidityProxy = contract.fromArtifact('KollateralLiquidityProxy');
const MockSoloMargin = contract.fromArtifact('MockSoloMargin');
const SoloLiquidityProxy = contract.fromArtifact('SoloLiquidityProxy');
const KEther = contract.fromArtifact('KEther');
const TestToken = contract.fromArtifact('TestToken');
const WETH9 = contract.fromArtifact('WETH9');
const KErc20 = contract.fromArtifact('KErc20');
const TestInvokable = contract.fromArtifact('TestInvokable');

function encodeExecute(testType, dataAbi, data) {
  const encodedData = ethers.utils.defaultAbiCoder.encode(dataAbi, data);
  return ethers.utils.defaultAbiCoder.encode(["uint256", "bytes"], [testType, encodedData]);
}

describe('SoloLiquidityProxy', function () {
  describe('for Ether borrows', function () {
    const [ ownerAddress, userAddress, kEtherVaultAddress, invokerVaultAddress ] = accounts;
    const noopInvokerBalance = new BN(10000);
    const kEtherUnderlyingBalance = new BN(100000);
  
    beforeEach(async function () {
      this.weth = await WETH9.new({from: ownerAddress});
      this.solo = await MockSoloMargin.new([0], [this.weth.address], {from: ownerAddress});
  
      this.proxy = await SoloLiquidityProxy.new(this.solo.address, this.weth.address, {from: ownerAddress});
      await this.proxy.registerPool(0, {from: ownerAddress});
  
      this.kEther2 = await KEther.new({from: ownerAddress});
      await this.kEther2.setPlatformReward(5, {from: ownerAddress});
      await this.kEther2.setPoolReward(20, {from: ownerAddress});
      await this.kEther2.setPlatformVaultAddress(kEtherVaultAddress, {from: ownerAddress});
  
      this.proxy2 = await KollateralLiquidityProxy.new({from: ownerAddress});
      await this.proxy2.registerPool(ETHER_TOKEN_ADDRESS, this.kEther2.address, {from: ownerAddress});
  
      this.invoker = await Invoker.new({from: ownerAddress});
      await this.invoker.setLiquidityProxies(ETHER_TOKEN_ADDRESS, [this.proxy.address, this.proxy2.address], {from: ownerAddress});
      await this.invoker.setPlatformReward(5, {from: ownerAddress});
      await this.invoker.setPoolReward(0, {from: ownerAddress});
      await this.invoker.setPlatformVaultAddress(invokerVaultAddress, {from: ownerAddress});
  
      this.invokable = await TestInvokable.new({from: ownerAddress});
      await this.invokable.sendTransaction({value: noopInvokerBalance.toString()});
  
      await this.weth.deposit({value: kEtherUnderlyingBalance.toString()});
      await this.weth.transfer(this.solo.address, kEtherUnderlyingBalance.toString());
      await this.kEther2.mint({value: kEtherUnderlyingBalance.toString()});
    });
  
    describe('invoke', function () {
      describe('when borrow single pool with successful repay', function () {
        const underlyingAmount = kEtherUnderlyingBalance;
        const underlyingBalanceRepayAmount = new BN(100051);
        const underlyingBalanceWithReward = new BN(100001);
        const resultingPlatformReward = new BN(50);
        const resultingPoolReward = new BN(0);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await balance.current(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], ETHER_TOKEN_ADDRESS, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = ETHER_TOKEN_ADDRESS;
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: true
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kEther vault balance', async function () {
          expect(await balance.current(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(50));
        });
      });
  
      describe('when borrow multi-pool with successful repay', function () {
        const underlyingAmount = kEtherUnderlyingBalance.muln(2);
        const underlyingBalanceRepayAmount = new BN(100051 + 100300);
        const underlyingBalanceWithReward = new BN(100200 + 40);
        const resultingPlatformReward = new BN(100);
        const resultingPoolReward = new BN(0);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await balance.current(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], ETHER_TOKEN_ADDRESS, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = ETHER_TOKEN_ADDRESS;
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: true
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments invoker vault balance', async function () {
          expect(await balance.current(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(100));
        });
      });

      describe('when borrow single pool with first proxy disabled successful repay', function () {
        const underlyingAmount = kEtherUnderlyingBalance;
        const underlyingBalanceRepayAmount = new BN(100300);
        const underlyingBalanceWithReward = new BN(100200);
        const resultingPlatformReward = new BN(50);
        const resultingPoolReward = new BN(0);

        beforeEach('invoking', async function () {
          await this.solo.setClosed(true);

          this.invokerVaultStartingBalance = await balance.current(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], ETHER_TOKEN_ADDRESS, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = ETHER_TOKEN_ADDRESS;
        });

        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];

          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });

        it('emits Invocation event', async function () {
          const event = this.logs[0];

          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });

        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: true
          });

          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });

        it('increments kEther vault balance', async function () {
          expect(await balance.current(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(50));
        });
      });

      /*
       * VIEWS
       */

      describe('when calling totalLiquidity', function () {
        it('returns liquidity for registered token', async function () {
          expect(await this.invoker.totalLiquidity(ETHER_TOKEN_ADDRESS)).to.be.bignumber.equal(kEtherUnderlyingBalance.muln(2));
        });

        it('returns 0 for nonregistered token', async function () {
          expect(await this.invoker.totalLiquidity(OTHER_TOKEN_ADDRESS)).to.be.bignumber.equal(new BN(0));
        });
      });

      describe('when calling estimateRepaymentAmount', function () {
        it('returns correct amount for single pool', async function () {
          expect(await this.invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance))
            .to.be.bignumber.equal(new BN(100051));
        });

        it('returns correct amount for multi pool', async function () {
          expect(await this.invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance.muln(2)))
            .to.be.bignumber.equal(new BN(200351));
        });

        it('reverts for too high amount', async function () {
          await expectRevert(this.invoker.estimateRepaymentAmount(ETHER_TOKEN_ADDRESS, kEtherUnderlyingBalance.muln(3)),
            "Invoker: not enough liquidity");
        });

        it('reverts for nonregistered token', async function () {
          await expectRevert(this.invoker.estimateRepaymentAmount(OTHER_TOKEN_ADDRESS, new BN(0)),
            "Invoker: no liquidity for token");
        });
      });
    });
  });

  describe('for ERC20 borrows', function () {
    const [ ownerAddress, userAddress, kErc20VaultAddress, invokerVaultAddress ] = accounts;
    const erc20Balance = new BN(10).pow(new BN(20)); // 100 TT
    const noopInvokerBalance = new BN(10000);
    const kErc20UnderlyingBalance = new BN(100000);
  
    beforeEach(async function () {
      this.erc20 = await TestToken.new("Test Token", "TT", 18, {from: ownerAddress});
      this.solo = await MockSoloMargin.new([1], [this.erc20.address], {from: ownerAddress});

      this.proxy = await SoloLiquidityProxy.new(this.solo.address, OTHER_TOKEN_ADDRESS, {from: ownerAddress});
      await this.proxy.registerPool(1, {from: ownerAddress});
  
      this.kErc202 = await KErc20.new(this.erc20.address, "Kollateral2 TT", "kTT", 18, {from: ownerAddress});
      
      await this.kErc202.setPlatformReward(5, {from: ownerAddress});
      await this.kErc202.setPoolReward(20, {from: ownerAddress});
      await this.kErc202.setPlatformVaultAddress(kErc20VaultAddress, {from: ownerAddress});
  
      this.proxy2 = await KollateralLiquidityProxy.new({from: ownerAddress});
      await this.proxy2.registerPool(this.erc20.address, this.kErc202.address, {from: ownerAddress});
  
      this.invoker = await Invoker.new({from: ownerAddress});
      await this.invoker.setLiquidityProxies(this.erc20.address, [this.proxy.address, this.proxy2.address], {from: ownerAddress});
      await this.invoker.setPlatformReward(5, {from: ownerAddress});
      await this.invoker.setPoolReward(0, {from: ownerAddress});
      await this.invoker.setPlatformVaultAddress(invokerVaultAddress, {from: ownerAddress});
  
      this.invokable = await TestInvokable.new({from: ownerAddress});
      await this.erc20.mint(noopInvokerBalance.toString());
      await this.erc20.transfer(this.invokable.address, noopInvokerBalance.toString());

      await this.erc20.mint(kErc20UnderlyingBalance.muln(2));
      await this.erc20.transfer(this.solo.address, kErc20UnderlyingBalance.toString());
      await this.erc20.approve(this.kErc202.address, kErc20UnderlyingBalance);
      await this.kErc202.mint(kErc20UnderlyingBalance);

      await this.erc20.mint(erc20Balance.toString());
    });
  
    describe('invoke', function () {
      describe('when borrow single pool with successful repay', function () {
        const underlyingAmount = kErc20UnderlyingBalance;
        const underlyingBalanceRepayAmount = new BN(100051);
        const underlyingBalanceWithReward = new BN(100001);
        const resultingPlatformReward = new BN(50);
        const resultingPoolReward = new BN(0);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await this.erc20.balanceOf(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], this.erc20.address, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = await this.erc20.address;
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: false
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kErc20 vault balance', async function () {
          expect(await this.erc20.balanceOf(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(50));
        });
      });
  
      describe('when borrow multi-pool with successful repay', function () {
        const underlyingAmount = kErc20UnderlyingBalance.muln(2);
        const underlyingBalanceRepayAmount = new BN(100051 + 100300);
        const underlyingBalanceWithReward = new BN(100200 + 40);
        const resultingPlatformReward = new BN(100);
        const resultingPoolReward = new BN(0);
  
        beforeEach('invoking', async function () {
          this.invokerVaultStartingBalance = await this.erc20.balanceOf(invokerVaultAddress);
          const invokeTo = this.invokable.address;
          const receipt = await this.invoker.invoke(invokeTo, [], this.erc20.address, underlyingAmount);
          this.logs = receipt.logs;
          this.txHash = receipt.tx;
          this.underlying = await this.erc20.address;
        });
  
        it('emits Reward event', async function () {
          const event = this.logs[this.logs.length - 1];
  
          expect(event.args.tokenAddress).to.be.equal(this.underlying);
          expect(event.args.platformReward).to.be.bignumber.equal(resultingPlatformReward);
          expect(event.args.poolReward).to.be.bignumber.equal(resultingPoolReward);
        });
  
        it('emits Invocation event', async function () {
          const event = this.logs[0];
  
          expect(event.args.invokeTo).to.be.equal(this.invokable.address);
          expect(event.args.invokeValue).to.be.bignumber.equal(new BN(0));
          expect(event.args.underlyingAmount).to.be.bignumber.equal(underlyingAmount);
        });
  
        it('emits HelperDump event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, TestInvokable, 'HelperDump', {
            currentTokenAddress: this.underlying,
            isCurrentTokenEther: false
          });
  
          expect(event.args.currentTokenAmount).to.be.bignumber.equal(underlyingAmount);
          expect(event.args.currentRepaymentAmount).to.be.bignumber.equal(underlyingBalanceRepayAmount);
        });
  
        it('increments kErc20 vault balance', async function () {
          expect(await this.erc20.balanceOf(invokerVaultAddress)).to.be.bignumber.equal(this.invokerVaultStartingBalance.addn(100));
        });
      });

      /*
       * VIEWS
       */

      describe('when calling totalLiquidity', function () {
        it('returns liquidity for registered token', async function () {
          expect(await this.invoker.totalLiquidity(this.erc20.address)).to.be.bignumber.equal(kErc20UnderlyingBalance.muln(2));
        });

        it('returns 0 for nonregistered token', async function () {
          expect(await this.invoker.totalLiquidity(OTHER_TOKEN_ADDRESS)).to.be.bignumber.equal(new BN(0));
        });
      });

      describe('when calling estimateRepaymentAmount', function () {
        it('returns correct amount for single pool', async function () {
          expect(await this.invoker.estimateRepaymentAmount(this.erc20.address, kErc20UnderlyingBalance))
            .to.be.bignumber.equal(new BN(100051));
        });

        it('returns correct amount for multi pool', async function () {
          expect(await this.invoker.estimateRepaymentAmount(this.erc20.address, kErc20UnderlyingBalance.muln(2)))
            .to.be.bignumber.equal(new BN(200351));
        });

        it('reverts for too high amount', async function () {
          await expectRevert(this.invoker.estimateRepaymentAmount(this.erc20.address, kErc20UnderlyingBalance.muln(3)),
            "Invoker: not enough liquidity");
        });

        it('reverts for nonregistered token', async function () {
          await expectRevert(this.invoker.estimateRepaymentAmount(OTHER_TOKEN_ADDRESS, new BN(0)),
            "Invoker: no liquidity for token");
        });
      });
    });
  });
});