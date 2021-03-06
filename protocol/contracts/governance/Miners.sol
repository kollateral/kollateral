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

        ▓▓▓▓▓▓▓▓▓▓
      ▓▓▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓
        ▓▓▓▓▓▓▓▓▒▒▒▒▒▒██
                ▓▓▒▒▒▒▓▓
              ▓▓▓▓██▒▒▒▒▓▓
            ▓▓▒▒██  ▓▓▒▒▓▓
          ▓▓▓▓██    ▓▓▒▒▓▓
        ▓▓▒▒██      ▓▓▒▒▓▓
      ▓▓▓▓██        ▓▓▒▒▓▓
    ▓▓▒▒██            ▓▓
  ▓▓▓▓██                          ████
▓▓▒▒██                      ██████    ██
▓▓██                  ██████            ██
                ██████                    ██
              ██░░                  ▒▒▒▒▒▒▒▒██
              ██  ░░          ▒▒▒▒▒▒        ██
              ██    ░░  ▒▒▒▒▒▒          ▒▒▒▒██
              ██      ░░          ▒▒▒▒▒▒▒▒▒▒██
              ██▒▒▒▒  ░░    ▒▒▒▒▒▒▒▒▒▒██████
                ██▒▒░░░░▒▒▒▒▒▒▒▒██████
                  ██▒▒░░▒▒██████
                    ██████

*/
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.2;

import "hardhat/console.sol";

import "../interfaces/governance/ICrownGovernanceToken.sol";

import "../libraries/governance/LibCrownStorage.sol";

/**
 * @title Miners (prev. SupplyManager)
 * @dev Collective responsible for enacting decisions related to Crown governance token supply
 * @notice Decisions are made via a timelocked propose/accept scheme
 * @notice Initial proposal length (timelock) is 30 days
 */
contract Miners {
	/// @notice Crown Governance token
	ICrownGovernanceToken public token;

	/// @notice Address which may make changes the token supply by calling provided functions
	address public king;

	/// @notice The timestamp after which a change may occur
	uint256 public changeAllowedAfter;

	/// @notice The current time between proposal and acceptance
	uint32 public proposalLength = 1 days * 30;

	/// @notice The minimum time between proposal and acceptance
	uint32 public proposalLengthMinimum = 1 days * 7;

	/// @notice New king proposal
	struct RoyalDecree {
		uint256 eta;
		address newKing;
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
	struct MinersProposal {
		uint256 eta;
		address newMiners;
	}

	/// @notice New proposal length proposal
	struct ProposalLengthProposal {
		uint256 eta;
		uint32 newLength;
	}

	/// @notice Current pending king proposal
	RoyalDecree public pendingKing;

	/// @notice Current pending mint proposal
	MintProposal public pendingMint;

	/// @notice Current pending burn proposal
	BurnProposal public pendingBurn;

	/// @notice Current pending mint cap proposal
	MintCapProposal public pendingMintCap;

	/// @notice Current pending waiting period proposal
	WaitingPeriodProposal public pendingWaitingPeriod;

	/// @notice Current pending supply manager proposal
	MinersProposal public pendingMiners;

	/// @notice Current pending proposal length proposal
	ProposalLengthProposal public pendingProposalLength;

	/// @notice An event that's emitted when a new king is proposed
	event KingProposed(address indexed oldKing, address indexed newKing, uint256 eta);

	/// @notice An event that's emitted when an king proposal is canceled
	event KingCanceled(address indexed proposedKing);

	/// @notice An event that's emitted when a new king is accepted
	event KingAccepted(address indexed oldKing, address indexed newKing);

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
	event MinersProposed(address indexed oldMiners, address indexed newMiners, uint256 eta);

	/// @notice An event that's emitted when a supply manager proposal is canceled
	event MinersCanceled(address indexed proposedMiners);

	/// @notice An event that's emitted when a new supply manager is accepted
	event MinersAccepted(address indexed oldMiners, address indexed newMiners);

	/// @notice An event that's emitted when a new proposal length is proposed
	event ProposalLengthProposed(uint32 indexed oldProposalLength, uint32 indexed newProposalLength, uint256 eta);

	/// @notice An event that's emitted when a proposal length proposal is canceled
	event ProposalLengthCanceled(uint32 indexed proposedProposalLength);

	/// @notice An event that's emitted when a new proposal length is accepted
	event ProposalLengthAccepted(uint32 indexed oldProposalLength, uint32 indexed newProposalLength);

	/// @notice restrict functions to just owner address
	modifier onlyTheKing {
		CrownStorage storage crown = LibCrownStorage.crownStorage();
		require(crown.king == address(0) || msg.sender == crown.king, "Crown::onlyTheKing: not the king");
		_;
	}

	/**
	 * @notice Construct a new supply manager
	 * @param _token The address for the token
	 * @param _king The king account for this contract
	 */
	constructor(address _token, address _king) {
		token = ICrownGovernanceToken(_token);
		changeAllowedAfter = token.supplyChangeAllowedAfter();
		king = _king;
	}

	/**
	 * @notice Propose a new token mint
	 * @param dst The address of the destination account
	 * @param amount The number of tokens to be minted
	 */
	function proposeMint(address dst, uint256 amount) external onlyTheKing {
		uint256 currentSupply = token.totalSupply();
		require(dst != address(0), "Miners::proposeMint: cannot transfer to the zero address");
		require(amount <= (currentSupply * token.mintCap()) / 1000000, "Miners::proposeMint: amount exceeds mint cap");
		uint256 eta = block.timestamp + proposalLength;
		require(eta >= token.supplyChangeAllowedAfter(), "Miners::proposeMint: minting not allowed yet");
		pendingMint = MintProposal(eta, dst, amount);
		emit MintProposed(amount, dst, currentSupply, currentSupply + amount, eta);
	}

	/**
	 * @notice Cancel proposed token mint
	 */
	function cancelMint() external onlyTheKing {
		require(pendingMint.eta != 0, "Miners::cancelMint: no active proposal");
		emit MintCanceled(pendingMint.amount, pendingMint.destination);
		pendingMint = MintProposal(0, address(0), 0);
	}

	/**
	 * @notice Accept proposed token mint
	 */
	function acceptMint() external onlyTheKing {
		require(pendingMint.eta != 0, "Miners::acceptMint: no active proposal");
		require(block.timestamp >= pendingMint.eta, "Miners::acceptMint: proposal eta not yet passed");
		address dst = pendingMint.destination;
		uint256 amount = pendingMint.amount;
		uint256 oldSupply = token.totalSupply();
		pendingMint = MintProposal(0, address(0), 0);
		require(token.mint(dst, amount), "Miners::acceptMint: unsuccessful");
		emit MintAccepted(amount, dst, oldSupply, oldSupply + amount);
	}

	/**
	 * @notice Propose a new token burn
	 * @param src The address of the account that will burn tokens
	 * @param amount The number of tokens to be burned
	 */
	function proposeBurn(address src, uint256 amount) external onlyTheKing {
		require(src != address(0), "Miners::proposeBurn: cannot transfer from the zero address");
		require(token.allowance(src, address(this)) >= amount, "Miners::proposeBurn: supplyManager approval < amount");
		uint256 currentSupply = token.totalSupply();
		uint256 newSupply = currentSupply - amount;
		uint256 eta = block.timestamp + proposalLength;
		require(eta >= token.supplyChangeAllowedAfter(), "Miners::proposeBurn: burning not allowed yet");
		pendingBurn = BurnProposal(eta, src, amount);
		emit BurnProposed(amount, src, currentSupply, newSupply, eta);
	}

	/**
	 * @notice Cancel proposed token burn
	 */
	function cancelBurn() external onlyTheKing {
		require(pendingBurn.eta != 0, "Miners::cancelBurn: no active proposal");
		emit BurnCanceled(pendingBurn.amount, pendingBurn.source);
		pendingBurn = BurnProposal(0, address(0), 0);
	}

	/**
	 * @notice Accept proposed token burn
	 */
	function acceptBurn() external onlyTheKing {
		require(pendingBurn.eta != 0, "Miners::acceptBurn: no active proposal");
		require(block.timestamp >= pendingBurn.eta, "Miners::acceptBurn: proposal eta not yet passed");
		address src = pendingBurn.source;
		uint256 amount = pendingBurn.amount;
		pendingBurn = BurnProposal(0, address(0), 0);
		require(token.burn(src, amount), "Miners::acceptBurn: unsuccessful");
		uint256 newSupply = token.totalSupply();
		emit BurnAccepted(amount, src, newSupply + amount, newSupply);
	}

	/**
	 * @notice Propose change to the maximum amount of tokens that can be minted at once
	 * @param newCap The new mint cap in bips (10,000 bips = 1% of totalSupply)
	 */
	function proposeMintCap(uint32 newCap) external onlyTheKing {
		uint256 eta = block.timestamp + proposalLength;
		pendingMintCap = MintCapProposal(eta, newCap);
		emit MintCapProposed(token.mintCap(), newCap, eta);
	}

	/**
	 * @notice Cancel proposed mint cap
	 */
	function cancelMintCap() external onlyTheKing {
		require(pendingMintCap.eta != 0, "Miners::cancelMC: no active proposal");
		emit MintCapCanceled(pendingMintCap.newCap);
		pendingMintCap = MintCapProposal(0, 0);
	}

	/**
	 * @notice Accept change to the maximum amount of tokens that can be minted at once
	 */
	function acceptMintCap() external onlyTheKing {
		require(pendingMintCap.eta != 0, "Miners::acceptMC: no active proposal");
		require(block.timestamp >= pendingMintCap.eta, "Miners::acceptMC: proposal eta not yet passed");
		uint32 oldCap = token.mintCap();
		uint32 newCap = pendingMintCap.newCap;
		pendingMintCap = MintCapProposal(0, 0);
		require(token.setMintCap(newCap), "Miners::acceptMC: unsuccessful");
		emit MintCapAccepted(oldCap, newCap);
	}

	/**
	 * @notice Propose change to the supply change waiting period
	 * @param newPeriod new waiting period
	 */
	function proposeSupplyChangeWaitingPeriod(uint32 newPeriod) external onlyTheKing {
		uint256 eta = block.timestamp + proposalLength;
		pendingWaitingPeriod = WaitingPeriodProposal(eta, newPeriod);
		emit WaitingPeriodProposed(token.supplyChangeWaitingPeriod(), newPeriod, eta);
	}

	/**
	 * @notice Cancel proposed waiting period
	 */
	function cancelWaitingPeriod() external onlyTheKing {
		require(pendingWaitingPeriod.eta != 0, "Miners::cancelWaitingPeriod: no active proposal");
		pendingWaitingPeriod = WaitingPeriodProposal(0, 0);
		emit WaitingPeriodCanceled(pendingWaitingPeriod.newPeriod);
	}

	/**
	 * @notice Accept change to the supply change waiting period
	 */
	function acceptSupplyChangeWaitingPeriod() external onlyTheKing {
		require(pendingWaitingPeriod.eta != 0, "Miners::acceptWP: no active proposal");
		require(block.timestamp >= pendingWaitingPeriod.eta, "Miners::acceptWP: proposal eta not yet passed");
		uint32 oldPeriod = token.supplyChangeWaitingPeriod();
		uint32 newPeriod = pendingWaitingPeriod.newPeriod;
		pendingWaitingPeriod = WaitingPeriodProposal(0, 0);
		require(token.setSupplyChangeWaitingPeriod(newPeriod), "Miners::acceptWP: unsuccessful");
		emit WaitingPeriodAccepted(oldPeriod, newPeriod);
	}

	/**
	 * @notice Propose change to the supplyManager address
	 * @param newMiners new supply manager address
	 */
	function proposeMiners(address newMiners) external onlyTheKing {
		uint256 eta = block.timestamp + proposalLength;
		pendingMiners = MinersProposal(eta, newMiners);
		emit MinersProposed(token.supplyManager(), newMiners, eta);
	}

	/**
	 * @notice Cancel proposed supply manager update
	 */
	function cancelMiners() external onlyTheKing {
		require(pendingMiners.eta != 0, "Miners::cancelSM: no active proposal");
		emit MinersCanceled(pendingMiners.newMiners);
		pendingMiners = MinersProposal(0, address(0));
	}

	/**
	 * @notice Accept change to the supplyManager address
	 */
	function acceptMiners() external onlyTheKing {
		require(pendingMiners.eta != 0, "Miners::acceptSM: no active proposal");
		require(block.timestamp >= pendingMiners.eta, "Miners::acceptSM: proposal eta not yet passed");
		address oldMiners = token.supplyManager();
		address newMiners = pendingMiners.newMiners;
		pendingMiners = MinersProposal(0, address(0));
		require(token.setSupplyManager(newMiners), "Miners::acceptSM: unsuccessful");
		emit MinersAccepted(oldMiners, newMiners);
	}

	/**
	 * @notice Propose change to the proposal length
	 * @param newLength new proposal length
	 */
	function proposeNewProposalLength(uint32 newLength) external onlyTheKing {
		require(newLength >= proposalLengthMinimum, "Miners::proposePL: length must be >= minimum");
		uint256 eta = block.timestamp + proposalLength;
		pendingProposalLength = ProposalLengthProposal(eta, newLength);
		emit ProposalLengthProposed(proposalLength, newLength, eta);
	}

	/**
	 * @notice Cancel proposed update to proposal length
	 */
	function cancelProposalLength() external onlyTheKing {
		require(pendingProposalLength.eta != 0, "Miners::cancelPL: no active proposal");
		emit ProposalLengthCanceled(pendingProposalLength.newLength);
		pendingProposalLength = ProposalLengthProposal(0, 0);
	}

	/**
	 * @notice Accept change to the proposal length
	 */
	function acceptProposalLength() external onlyTheKing {
		require(pendingProposalLength.eta != 0, "Miners::acceptPL: no active proposal");
		require(block.timestamp >= pendingProposalLength.eta, "Miners::acceptPL: proposal eta not yet passed");
		uint32 oldLength = proposalLength;
		uint32 newLength = pendingProposalLength.newLength;
		pendingProposalLength = ProposalLengthProposal(0, 0);
		proposalLength = newLength;
		emit ProposalLengthAccepted(oldLength, newLength);
	}

	/**
	 * @notice Propose a new king
	 * @param newKing The address of the new king
	 */
	function proposeKing(address newKing) external onlyTheKing {
		// ETA set to minimum to allow for quicker changes if necessary
		uint256 eta = block.timestamp + proposalLengthMinimum;
		pendingKing = RoyalDecree(eta, newKing);
		emit KingProposed(king, newKing, eta);
	}

	/**
	 * @notice Cancel proposed king change
	 */
	function cancelKing() external onlyTheKing {
		require(pendingKing.eta != 0, "Miners::cancelKing: no active proposal");
		emit KingCanceled(pendingKing.newKing);
		pendingKing = RoyalDecree(0, address(0));
	}

	/**
	 * @notice Accept proposed king
	 */
	function acceptKing() external onlyTheKing {
		require(pendingKing.eta != 0, "Miners::acceptKing: no active proposal");
		require(block.timestamp >= pendingKing.eta, "Miners::acceptKing: proposal eta not yet passed");
		address oldKing = king;
		address newKing = pendingKing.newKing;
		pendingKing = RoyalDecree(0, address(0));
		king = newKing;
		emit KingAccepted(oldKing, newKing);
	}
}
