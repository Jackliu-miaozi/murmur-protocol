// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title VPToken
 * @notice Global VP Token contract - ERC-1155 token for Voice Points
 * @dev Users stake vDOT to get VP, which can be used across all topics
 */
contract VPToken is ERC1155, Ownable, IVPToken {
    // vDOT token address
    IERC20 public immutable vdotToken;

    // VP calculation constant: VP = k * sqrt(vDOT), where k = 100
    uint256 public constant K = 100;
    uint256 private constant PRECISION = 1e18;

    // Track staked vDOT per user
    mapping(address => uint256) public stakedVdot;

    // Total staked vDOT
    uint256 public totalStakedVdot;

    // Token ID for VP (ERC-1155)
    uint256 private constant VP_TOKEN_ID = 0;

    event VdotStaked(address indexed user, uint256 vdotAmount, uint256 vpAmount);
    event VPBurned(address indexed user, uint256 amount);
    event VPMinted(address indexed user, uint256 amount);

    constructor(address _vdotToken, address initialOwner) ERC1155("") Ownable(initialOwner) {
        vdotToken = IERC20(_vdotToken);
    }

    /**
     * @notice Stake vDOT to get VP
     * @param amount Amount of vDOT to stake
     * @return vpAmount Amount of VP minted
     */
    function stakeVdot(uint256 amount) external returns (uint256 vpAmount) {
        require(amount > 0, "VPToken: amount must be greater than 0");

        // Transfer vDOT from user
        vdotToken.transferFrom(msg.sender, address(this), amount);

        // Calculate VP: VP = 100 * sqrt(vDOT)
        vpAmount = calculateVP(amount);

        // Update staked amount
        stakedVdot[msg.sender] += amount;
        totalStakedVdot += amount;

        // Mint VP tokens (ERC-1155)
        _mint(msg.sender, VP_TOKEN_ID, vpAmount, "");

        emit VdotStaked(msg.sender, amount, vpAmount);
    }

    /**
     * @notice Get VP balance for a user
     * @param user User address
     * @return balance VP balance
     */
    function balanceOf(address user) external view returns (uint256 balance) {
        return balanceOf(user, VP_TOKEN_ID);
    }

    /**
     * @notice Burn VP tokens
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "VPToken: caller is not owner nor approved"
        );
        _burn(from, VP_TOKEN_ID, amount);
        emit VPBurned(from, amount);
    }

    /**
     * @notice Mint VP tokens (for refund)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, VP_TOKEN_ID, amount, "");
        emit VPMinted(to, amount);
    }

    /**
     * @notice Calculate VP amount from vDOT amount
     * @param vdotAmount Amount of vDOT
     * @return vpAmount Amount of VP
     * @dev VP = 100 * sqrt(vDOT)
     */
    function calculateVP(uint256 vdotAmount) public pure returns (uint256 vpAmount) {
        // VP = 100 * sqrt(vDOT)
        // Using fixed point math: sqrt(vdotAmount * PRECISION) * 100 / sqrt(PRECISION)
        uint256 sqrtVdot = sqrt(vdotAmount * PRECISION);
        vpAmount = (sqrtVdot * K) / sqrt(PRECISION);
    }

    /**
     * @notice Calculate square root using Babylonian method
     * @param x Input value
     * @return sqrt Square root
     */
    function sqrt(uint256 x) internal pure returns (uint256 sqrt) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @notice Withdraw vDOT (only owner, for emergency)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawVdot(address to, uint256 amount) external onlyOwner {
        vdotToken.transfer(to, amount);
    }
}
