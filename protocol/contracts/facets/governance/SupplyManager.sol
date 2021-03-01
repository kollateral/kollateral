/*

	Copyright (c) [2020] [Archer DAO]
    Copyright 2020-2021 ARM Finance LLC

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.1;

import "hardhat/console.sol";

import "../../interfaces/governance/ICrownGovernanceToken.sol";

import "../../libraries/math/SafeMath.sol";

/**
 * @title SupplyManager
 * @dev Responsible for enacting decisions related to Crown governance token supply
 * @notice Decisions are made via a timelocked propose/accept scheme
 * @notice Initial proposal length (timelock) is 30 days
 */
contract SupplyManager {
	using SafeMath for uint256;

	/// @notice Crown Governance token
	ICrownGovernanceToken public token;

	/// @notice Address which may make changes to token supply by calling provided functions
	address public admin;

	/// @notice The timestamp after which a change may occur
	uint256 public changeAllowedAfter;

	/// @notice The current time between proposal and acceptance
	uint32 public proposalLength = 1 days * 30;

	/// @notice The minimum time between proposal and acceptance
	uint32 public proposalLengthMinimum = 1 days * 7;

	/// @notice New admin proposal
	struct AdminProposal {
		uint256 eta;
		address newAdmin;
	}

	/// @notice New mint proposal
	struct MintProposal {
		uint256 eta;
		address destination;
		uint256 amount;
	}

	/// @notice New burn proposal
	struct BurnProposal {
		uint256 eta;
		address source;
		uint256 amount;
	}

	/// @notice New mint cap proposal
	struct MintCapProposal {
		uint256 eta;
		uint32 newCap;
	}

	/// @notice New waiting period proposal
	struct WaitingPeriodProposal {
		uint256 eta;
		uint32 newPeriod;
	}

	/// @notice New supply manager proposal
	struct SupplyManagerProposal {
		uint256 eta;
		address newSupplyManager;
	}

	/// @notice New proposal length proposal
	struct ProposalLengthProposal {
		uint256 eta;
		uint32 newLength;
	}

	/// @notice Current pending admin proposal
	AdminProposal public pendingAdmin;

	/// @notice Current pending mint proposal
	MintProposal public pendingMint;

	/// @notice Current pending burn proposal
	BurnProposal public pendingBurn;

	/// @notice Current pending mint cap proposal
	MintCapProposal public pendingMintCap;

	/// @notice Current pending waiting period proposal
	WaitingPeriodProposal public pendingWaitingPeriod;

	/// @notice Current pending supply manager proposal
	SupplyManagerProposal public pendingSupplyManager;

	/// @notice Current pending proposal length proposal
	ProposalLengthProposal public pendingProposalLength;

	/// @notice An event that's emitted when a new admin is proposed
	event AdminProposed(address indexed oldAdmin, address indexed newAdmin, uint256 eta);

	/// @notice An event that's emitted when an admin proposal is canceled
	event AdminCanceled(address indexed proposedAdmin);

	/// @notice An event that's emitted when a new admin is accepted
	event AdminAccepted(address indexed oldAdmin, address indexed newAdmin);

	/// @notice An event that's emitted when a new mint is proposed
	event MintProposed(
		uint256 indexed amount,
		address indexed recipient,
		uint256 oldSupply,
		uint256 newSupply,
		uint256 eta
	);

	/// @notice An event that's emitted when a mint proposal is canceled
	event MintCanceled(uint256 indexed amount, address indexed recipient);

	/// @notice An event that's emitted when a new mint is accepted
	event MintAccepted(uint256 indexed amount, address indexed recipient, uint256 oldSupply, uint256 newSupply);

	/// @notice An event that's emitted when a new burn is proposed
	event BurnProposed(uint256 indexed amount, address indexed source, uint256 oldSupply, uint256 newSupply, uint256 eta);

	/// @notice An event that's emitted when a burn proposal is canceled
	event BurnCanceled(uint256 indexed amount, address indexed source);

	/// @notice An event that's emitted when a new burn is accepted
	event BurnAccepted(uint256 indexed amount, address indexed source, uint256 oldSupply, uint256 newSupply);

	/// @notice An event that's emitted when a new mint cap is proposed
	event MintCapProposed(uint32 indexed oldCap, uint32 indexed newCap, uint256 eta);

	/// @notice An event that's emitted when a mint cap proposal is canceled
	event MintCapCanceled(uint32 indexed proposedCap);

	/// @notice An event that's emitted when a new mint cap is accepted
	event MintCapAccepted(uint32 indexed oldCap, uint32 indexed newCap);

	/// @notice An event that's emitted when a new waiting period is proposed
	event WaitingPeriodProposed(uint32 indexed oldWaitingPeriod, uint32 indexed newWaitingPeriod, uint256 eta);

	/// @notice An event that's emitted when a waiting period proposal is canceled
	event WaitingPeriodCanceled(uint32 indexed proposedWaitingPeriod);

	/// @notice An event that's emitted when a new waiting period is accepted
	event WaitingPeriodAccepted(uint32 indexed oldWaitingPeriod, uint32 indexed newWaitingPeriod);

	/// @notice An event that's emitted when a new supply manager is proposed
	event SupplyManagerProposed(address indexed oldSupplyManager, address indexed newSupplyManager, uint256 eta);

	/// @notice An event that's emitted when a supply manager proposal is canceled
	event SupplyManagerCanceled(address indexed proposedSupplyManager);

	/// @notice An event that's emitted when a new supply manager is accepted
	event SupplyManagerAccepted(address indexed oldSupplyManager, address indexed newSupplyManager);

	/// @notice An event that's emitted when a new proposal length is proposed
	event ProposalLengthProposed(uint32 indexed oldProposalLength, uint32 indexed newProposalLength, uint256 eta);

	/// @notice An event that's emitted when a proposal length proposal is canceled
	event ProposalLengthCanceled(uint32 indexed proposedProposalLength);

	/// @notice An event that's emitted when a new proposal length is accepted
	event ProposalLengthAccepted(uint32 indexed oldProposalLength, uint32 indexed newProposalLength);

	/**
	 * @notice Construct a new supply manager
	 * @param _token The address for the token
	 * @param _admin The admin account for this contract
	 */
	constructor(address _token, address _admin) {
		token = ICrownGovernanceToken(_token);
		changeAllowedAfter = token.supplyChangeAllowedAfter();
		admin = _admin;
	}

	/**
	 * @notice Propose a new token mint
	 * @param dst The address of the destination account
	 * @param amount The number of tokens to be minted
	 */
	function proposeMint(address dst, uint256 amount) external {
		uint256 currentSupply = token.totalSupply();
		require(msg.sender == admin, "SM::proposeMint: caller must be admin");
		require(dst != address(0), "SM::proposeMint: cannot transfer to the zero address");
		require(amount <= currentSupply.mul(token.mintCap()).div(1000000), "SM::proposeMint: amount exceeds mint cap");
		uint256 eta = block.timestamp.add(proposalLength);
		require(eta >= token.supplyChangeAllowedAfter(), "SM::proposeMint: minting not allowed yet");
		pendingMint = MintProposal(eta, dst, amount);
		emit MintProposed(amount, dst, currentSupply, currentSupply.add(amount), eta);
	}

	/**
	 * @notice Cancel proposed token mint
	 */
	function cancelMint() external {
		require(msg.sender == admin, "SM::cancelMint: caller must be admin");
		require(pendingMint.eta != 0, "SM::cancelMint: no active proposal");
		emit MintCanceled(pendingMint.amount, pendingMint.destination);
		pendingMint = MintProposal(0, address(0), 0);
	}

	/**
	 * @notice Accept proposed token mint
	 */
	function acceptMint() external {
		require(msg.sender == admin, "SM::acceptMint: caller must be admin");
		require(pendingMint.eta != 0, "SM::acceptMint: no active proposal");
		require(block.timestamp >= pendingMint.eta, "SM::acceptMint: proposal eta not yet passed");
		address dst = pendingMint.destination;
		uint256 amount = pendingMint.amount;
		uint256 oldSupply = token.totalSupply();
		pendingMint = MintProposal(0, address(0), 0);
		require(token.mint(dst, amount), "SM::acceptMint: unsuccessful");
		emit MintAccepted(amount, dst, oldSupply, oldSupply.add(amount));
	}

	/**
	 * @notice Propose a new token burn
	 * @param src The address of the account that will burn tokens
	 * @param amount The number of tokens to be burned
	 */
	function proposeBurn(address src, uint256 amount) external {
		require(msg.sender == admin, "SM::proposeBurn: caller must be admin");
		require(src != address(0), "SM::proposeBurn: cannot transfer from the zero address");
		require(token.allowance(src, address(this)) >= amount, "SM::proposeBurn: supplyManager approval < amount");
		uint256 currentSupply = token.totalSupply();
		uint256 newSupply = currentSupply.sub(amount);
		uint256 eta = block.timestamp.add(proposalLength);
		require(eta >= token.supplyChangeAllowedAfter(), "SM::proposeBurn: burning not allowed yet");
		pendingBurn = BurnProposal(eta, src, amount);
		emit BurnProposed(amount, src, currentSupply, newSupply, eta);
	}

	/**
	 * @notice Cancel proposed token burn
	 */
	function cancelBurn() external {
		require(msg.sender == admin, "SM::cancelBurn: caller must be admin");
		require(pendingBurn.eta != 0, "SM::cancelBurn: no active proposal");
		emit BurnCanceled(pendingBurn.amount, pendingBurn.source);
		pendingBurn = BurnProposal(0, address(0), 0);
	}

	/**
	 * @notice Accept proposed token burn
	 */
	function acceptBurn() external {
		require(msg.sender == admin, "SM::acceptBurn: caller must be admin");
		require(pendingBurn.eta != 0, "SM::acceptBurn: no active proposal");
		require(block.timestamp >= pendingBurn.eta, "SM::acceptBurn: proposal eta not yet passed");
		address src = pendingBurn.source;
		uint256 amount = pendingBurn.amount;
		pendingBurn = BurnProposal(0, address(0), 0);
		require(token.burn(src, amount), "SM::acceptBurn: unsuccessful");
		uint256 newSupply = token.totalSupply();
		emit BurnAccepted(amount, src, newSupply.add(amount), newSupply);
	}

	/**
	 * @notice Propose change to the maximum amount of tokens that can be minted at once
	 * @param newCap The new mint cap in bips (10,000 bips = 1% of totalSupply)
	 */
	function proposeMintCap(uint32 newCap) external {
		require(msg.sender == admin, "SM::proposeMC: caller must be admin");
		uint256 eta = block.timestamp.add(proposalLength);
		pendingMintCap = MintCapProposal(eta, newCap);
		emit MintCapProposed(token.mintCap(), newCap, eta);
	}

	/**
	 * @notice Cancel proposed mint cap
	 */
	function cancelMintCap() external {
		require(msg.sender == admin, "SM::cancelMC: caller must be admin");
		require(pendingMintCap.eta != 0, "SM::cancelMC: no active proposal");
		emit MintCapCanceled(pendingMintCap.newCap);
		pendingMintCap = MintCapProposal(0, 0);
	}

	/**
	 * @notice Accept change to the maximum amount of tokens that can be minted at once
	 */
	function acceptMintCap() external {
		require(msg.sender == admin, "SM::acceptMC: caller must be admin");
		require(pendingMintCap.eta != 0, "SM::acceptMC: no active proposal");
		require(block.timestamp >= pendingMintCap.eta, "SM::acceptMC: proposal eta not yet passed");
		uint32 oldCap = token.mintCap();
		uint32 newCap = pendingMintCap.newCap;
		pendingMintCap = MintCapProposal(0, 0);
		require(token.setMintCap(newCap), "SM::acceptMC: unsuccessful");
		emit MintCapAccepted(oldCap, newCap);
	}

	/**
	 * @notice Propose change to the supply change waiting period
	 * @param newPeriod new waiting period
	 */
	function proposeSupplyChangeWaitingPeriod(uint32 newPeriod) external {
		require(msg.sender == admin, "SM::proposeWP: caller must be admin");
		uint256 eta = block.timestamp.add(proposalLength);
		pendingWaitingPeriod = WaitingPeriodProposal(eta, newPeriod);
		emit WaitingPeriodProposed(token.supplyChangeWaitingPeriod(), newPeriod, eta);
	}

	/**
	 * @notice Cancel proposed waiting period
	 */
	function cancelWaitingPeriod() external {
		require(msg.sender == admin, "SM::cancelWP: caller must be admin");
		require(pendingWaitingPeriod.eta != 0, "SM::cancelWaitingPeriod: no active proposal");
		pendingWaitingPeriod = WaitingPeriodProposal(0, 0);
		emit WaitingPeriodCanceled(pendingWaitingPeriod.newPeriod);
	}

	/**
	 * @notice Accept change to the supply change waiting period
	 */
	function acceptSupplyChangeWaitingPeriod() external {
		require(msg.sender == admin, "SM::acceptWP: caller must be admin");
		require(pendingWaitingPeriod.eta != 0, "SM::acceptWP: no active proposal");
		require(block.timestamp >= pendingWaitingPeriod.eta, "SM::acceptWP: proposal eta not yet passed");
		uint32 oldPeriod = token.supplyChangeWaitingPeriod();
		uint32 newPeriod = pendingWaitingPeriod.newPeriod;
		pendingWaitingPeriod = WaitingPeriodProposal(0, 0);
		require(token.setSupplyChangeWaitingPeriod(newPeriod), "SM::acceptWP: unsuccessful");
		emit WaitingPeriodAccepted(oldPeriod, newPeriod);
	}

	/**
	 * @notice Propose change to the supplyManager address
	 * @param newSupplyManager new supply manager address
	 */
	function proposeSupplyManager(address newSupplyManager) external {
		require(msg.sender == admin, "SM::proposeSM: caller must be admin");
		uint256 eta = block.timestamp.add(proposalLength);
		pendingSupplyManager = SupplyManagerProposal(eta, newSupplyManager);
		emit SupplyManagerProposed(token.supplyManager(), newSupplyManager, eta);
	}

	/**
	 * @notice Cancel proposed supply manager update
	 */
	function cancelSupplyManager() external {
		require(msg.sender == admin, "SM::cancelSM: caller must be admin");
		require(pendingSupplyManager.eta != 0, "SM::cancelSM: no active proposal");
		emit SupplyManagerCanceled(pendingSupplyManager.newSupplyManager);
		pendingSupplyManager = SupplyManagerProposal(0, address(0));
	}

	/**
	 * @notice Accept change to the supplyManager address
	 */
	function acceptSupplyManager() external {
		require(msg.sender == admin, "SM::acceptSM: caller must be admin");
		require(pendingSupplyManager.eta != 0, "SM::acceptSM: no active proposal");
		require(block.timestamp >= pendingSupplyManager.eta, "SM::acceptSM: proposal eta not yet passed");
		address oldSupplyManager = token.supplyManager();
		address newSupplyManager = pendingSupplyManager.newSupplyManager;
		pendingSupplyManager = SupplyManagerProposal(0, address(0));
		require(token.setSupplyManager(newSupplyManager), "SM::acceptSM: unsuccessful");
		emit SupplyManagerAccepted(oldSupplyManager, newSupplyManager);
	}

	/**
	 * @notice Propose change to the proposal length
	 * @param newLength new proposal length
	 */
	function proposeNewProposalLength(uint32 newLength) external {
		require(msg.sender == admin, "SM::proposePL: caller must be admin");
		require(newLength >= proposalLengthMinimum, "SM::proposePL: length must be >= minimum");
		uint256 eta = block.timestamp.add(proposalLength);
		pendingProposalLength = ProposalLengthProposal(eta, newLength);
		emit ProposalLengthProposed(proposalLength, newLength, eta);
	}

	/**
	 * @notice Cancel proposed update to proposal length
	 */
	function cancelProposalLength() external {
		require(msg.sender == admin, "SM::cancelPL: caller must be admin");
		require(pendingProposalLength.eta != 0, "SM::cancelPL: no active proposal");
		emit ProposalLengthCanceled(pendingProposalLength.newLength);
		pendingProposalLength = ProposalLengthProposal(0, 0);
	}

	/**
	 * @notice Accept change to the proposal length
	 */
	function acceptProposalLength() external {
		require(msg.sender == admin, "SM::acceptPL: caller must be admin");
		require(pendingProposalLength.eta != 0, "SM::acceptPL: no active proposal");
		require(block.timestamp >= pendingProposalLength.eta, "SM::acceptPL: proposal eta not yet passed");
		uint32 oldLength = proposalLength;
		uint32 newLength = pendingProposalLength.newLength;
		pendingProposalLength = ProposalLengthProposal(0, 0);
		proposalLength = newLength;
		emit ProposalLengthAccepted(oldLength, newLength);
	}

	/**
	 * @notice Propose a new admin
	 * @param newAdmin The address of the new admin
	 */
	function proposeAdmin(address newAdmin) external {
		require(msg.sender == admin, "SM::proposeAdmin: caller must be admin");
		// ETA set to minimum to allow for quicker changes if necessary
		uint256 eta = block.timestamp.add(proposalLengthMinimum);
		pendingAdmin = AdminProposal(eta, newAdmin);
		emit AdminProposed(admin, newAdmin, eta);
	}

	/**
	 * @notice Cancel proposed admin change
	 */
	function cancelAdmin() external {
		require(msg.sender == admin, "SM::cancelAdmin: caller must be admin");
		require(pendingAdmin.eta != 0, "SM::cancelAdmin: no active proposal");
		emit AdminCanceled(pendingAdmin.newAdmin);
		pendingAdmin = AdminProposal(0, address(0));
	}

	/**
	 * @notice Accept proposed admin
	 */
	function acceptAdmin() external {
		require(msg.sender == admin, "SM::acceptAdmin: caller must be admin");
		require(pendingAdmin.eta != 0, "SM::acceptAdmin: no active proposal");
		require(block.timestamp >= pendingAdmin.eta, "SM::acceptAdmin: proposal eta not yet passed");
		address oldAdmin = admin;
		address newAdmin = pendingAdmin.newAdmin;
		pendingAdmin = AdminProposal(0, address(0));
		admin = newAdmin;
		emit AdminAccepted(oldAdmin, newAdmin);
	}
}
