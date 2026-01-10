// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IVPToken.sol";

/**
 * @title VPToken
 * @notice Global VP Token contract - ERC-1155 token for Voice Points
 * @dev Users stake vDOT to get VP, which can be used across all topics
 */
contract VPToken is ERC1155, AccessControl, IVPToken {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

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
    event VdotWithdrawn(address indexed user, uint256 amount);
    event VPBurned(address indexed user, uint256 amount);
    event VPMinted(address indexed user, uint256 amount);

    constructor(address _vdotToken, address initialOwner) ERC1155("") {
        require(_vdotToken != address(0), "VPToken: invalid vdot address");
        require(initialOwner != address(0), "VPToken: invalid owner address");
        
        vdotToken = IERC20(_vdotToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(BURNER_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
    }

    /**
     * @notice Stake vDOT to get VP
     * @param amount Amount of vDOT to stake
     * @return vpAmount Amount of VP minted
     */
    function stakeVdot(uint256 amount) external returns (uint256 vpAmount) {
        require(amount > 0, "VPToken: amount must be greater than 0");

        // Transfer vDOT from user using SafeERC20
        vdotToken.safeTransferFrom(msg.sender, address(this), amount);

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
     * @notice Withdraw staked vDOT
     * @param amount Amount to withdraw
     */
    function withdrawVdot(uint256 amount) external {
        require(amount > 0, "VPToken: amount must be greater than 0");
        require(stakedVdot[msg.sender] >= amount, "VPToken: insufficient staked balance");

        stakedVdot[msg.sender] -= amount;
        totalStakedVdot -= amount;

        vdotToken.safeTransfer(msg.sender, amount);

        emit VdotWithdrawn(msg.sender, amount);
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
     * @notice Burn VP tokens (can be called by BURNER_ROLE or token owner)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external {
        require(
            from == msg.sender || 
            isApprovedForAll(from, msg.sender) ||
            hasRole(BURNER_ROLE, msg.sender),
            "VPToken: caller is not owner nor approved nor burner"
        );
        _burn(from, VP_TOKEN_ID, amount);
        emit VPBurned(from, amount);
    }

    /**
     * @notice Mint VP tokens (for refund, only MINTER_ROLE)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "VPToken: mint to zero address");
        _mint(to, VP_TOKEN_ID, amount, "");
        emit VPMinted(to, amount);
    }

    /**
     * @notice Calculate VP amount from vDOT amount
     * @param vdotAmount Amount of vDOT (in wei, 18 decimals)
     * @return vpAmount Amount of VP (in wei, 18 decimals)
     * @dev VP = K * sqrt(vDOT), where vDOT is in human-readable units
     *      For 18 decimal tokens: vpAmount = K * sqrt(vdotAmount) * sqrt(PRECISION)
     *      Example: 1000 vDOT (10^21 wei) -> 100 * sqrt(1000) = 3162 VP (3.162 * 10^21 wei)
     */
    function calculateVP(uint256 vdotAmount) public pure returns (uint256 vpAmount) {
        if (vdotAmount == 0) return 0;
        // VP = K * sqrt(vDOT) where vDOT is in human-readable units
        // Since vdotAmount is in wei (18 decimals), we need:
        // vpAmount = K * sqrt(vdotAmount) * sqrt(PRECISION)
        uint256 sqrtVdot = sqrt(vdotAmount);
        uint256 sqrtPrecision = sqrt(PRECISION);
        vpAmount = sqrtVdot * K * sqrtPrecision;
    }

    /**
     * @notice Calculate square root using Babylonian method
     * @param x Input value
     * @return y Square root
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    /**
     * @notice Emergency withdraw vDOT (only admin)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "VPToken: invalid recipient");
        require(vdotToken.balanceOf(address(this)) >= amount, "VPToken: insufficient balance");
        vdotToken.safeTransfer(to, amount);
        emit VdotWithdrawn(to, amount);
    }

    /**
     * @notice Check if contract supports interface
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
