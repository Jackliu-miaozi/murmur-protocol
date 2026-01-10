// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VDOTToken
 * @notice Simple ERC-20 vDOT Token for testing Murmur Protocol
 * @dev This is a minimal implementation for testing purposes
 *      In production, you would use an existing liquid staking derivative token
 */
contract VDOTToken is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Voted DOT", "vDOT") Ownable(initialOwner) {
        // Mint initial supply to deployer (for testing)
        // In production, this would be managed by a liquid staking protocol
        _mint(initialOwner, 1000000 * 10 ** decimals()); // 1,000,000 vDOT
    }

    /**
     * @notice Mint tokens (for testing purposes)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
