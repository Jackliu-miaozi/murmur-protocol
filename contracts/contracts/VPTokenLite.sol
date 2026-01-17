// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

/**
 * @title VPTokenLite
 * @notice Lightweight VP Token (Minimal Architecture V2)
 * @dev Simplified version without full ERC1155 and AccessControl
 */
contract VPTokenLite is Initializable, EIP712Upgradeable, UUPSUpgradeable {
  using SafeERC20 for IERC20;
  using ECDSA for bytes32;

  // Owner
  address public owner;

  // Operators (authorized backend signers)
  mapping(address => bool) public operators;

  // vDOT token address
  IERC20 public vdotToken;

  // VP calculation constant: VP = k * sqrt(vDOT), where k = 100
  uint256 public constant K = 100;
  uint256 private constant PRECISION = 1e18;

  // Track staked vDOT per user
  mapping(address => uint256) public stakedVdot;

  // Total staked vDOT
  uint256 public totalStakedVdot;

  // VP Balances
  mapping(address => uint256) public balances;

  // Batch operation nonce
  uint256 public batchNonce;

  // User-specific nonce for withdrawals
  mapping(address => uint256) public userNonce;

  // EIP-712 type hashes
  bytes32 private constant BATCH_BURN_TYPEHASH =
    keccak256("BatchBurn(address[] users,uint256[] amounts,uint256 nonce)");

  bytes32 private constant BATCH_MINT_TYPEHASH =
    keccak256("BatchMint(address[] users,uint256[] amounts,uint256 nonce)");

  bytes32 private constant WITHDRAW_TYPEHASH =
    keccak256(
      "Withdraw(address user,uint256 vpBurnAmount,uint256 vdotReturn,uint256 nonce)"
    );

  // Events
  event VdotStaked(address indexed user, uint256 vdotAmount, uint256 vpAmount);
  event VdotWithdrawn(
    address indexed user,
    uint256 vdotAmount,
    uint256 vpBurned
  );
  event VPBurned(address indexed user, uint256 amount);
  event VPMinted(address indexed user, uint256 amount);
  event BatchBurnExecuted(
    uint256 indexed nonce,
    uint256 totalUsers,
    uint256 totalAmount
  );
  event BatchMintExecuted(
    uint256 indexed nonce,
    uint256 totalUsers,
    uint256 totalAmount
  );
  event OperatorUpdated(address indexed operator, bool status);

  modifier onlyOwner() {
    require(msg.sender == owner, "VP: not owner");
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _vdotToken,
    address initialOwner
  ) public initializer {
    __EIP712_init("MurmurVPToken", "2");
    __UUPSUpgradeable_init();

    require(_vdotToken != address(0), "VP: invalid vdot address");
    require(initialOwner != address(0), "VP: invalid owner address");

    vdotToken = IERC20(_vdotToken);
    owner = initialOwner;
    operators[initialOwner] = true;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @notice Update operator status
   */
  function setOperator(address operator, bool status) external onlyOwner {
    operators[operator] = status;
    emit OperatorUpdated(operator, status);
  }

  /**
   * @notice Stake vDOT to get VP
   */
  function stakeVdot(uint256 amount) external returns (uint256 vpAmount) {
    require(amount > 0, "VP: amount must be > 0");

    vdotToken.safeTransferFrom(msg.sender, address(this), amount);

    vpAmount = calculateVP(amount);

    stakedVdot[msg.sender] += amount;
    totalStakedVdot += amount;

    balances[msg.sender] += vpAmount;

    emit VdotStaked(msg.sender, amount, vpAmount);
  }

  /**
   * @notice Withdraw vDOT by burning VP
   */
  function withdrawWithVP(
    uint256 vpBurnAmount,
    uint256 vdotReturn,
    uint256 nonce,
    bytes calldata signature
  ) external {
    require(vpBurnAmount > 0, "VP: burn amount > 0");
    require(vdotReturn > 0, "VP: return amount > 0");
    require(stakedVdot[msg.sender] >= vdotReturn, "VP: insufficient staked");
    require(balances[msg.sender] >= vpBurnAmount, "VP: insufficient VP");
    require(nonce == userNonce[msg.sender], "VP: invalid nonce");

    // Verify signature
    bytes32 structHash = keccak256(
      abi.encode(WITHDRAW_TYPEHASH, msg.sender, vpBurnAmount, vdotReturn, nonce)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(operators[signer], "VP: invalid signature");

    // Increment nonce
    userNonce[msg.sender]++;

    // Update state
    stakedVdot[msg.sender] -= vdotReturn;
    totalStakedVdot -= vdotReturn;
    balances[msg.sender] -= vpBurnAmount;

    // Transfer vDOT
    vdotToken.safeTransfer(msg.sender, vdotReturn);

    emit VdotWithdrawn(msg.sender, vdotReturn, vpBurnAmount);
  }

  /**
   * @notice Get VP balance
   */
  function balanceOf(address user) external view returns (uint256) {
    return balances[user];
  }

  /**
   * @notice Batch burn VP tokens
   */
  function batchBurn(
    address[] calldata users,
    uint256[] calldata amounts,
    uint256 nonce,
    bytes calldata signature
  ) external {
    require(users.length == amounts.length, "VP: length mismatch");
    require(users.length > 0, "VP: empty batch");
    require(nonce == batchNonce, "VP: invalid nonce");

    // Verify signature
    bytes32 structHash = keccak256(
      abi.encode(
        BATCH_BURN_TYPEHASH,
        keccak256(abi.encodePacked(users)),
        keccak256(abi.encodePacked(amounts)),
        nonce
      )
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(operators[signer], "VP: invalid signature");

    // Increment nonce
    batchNonce++;

    // Execute burns
    uint256 totalAmount = 0;
    for (uint256 i = 0; i < users.length; i++) {
      if (amounts[i] > 0 && balances[users[i]] >= amounts[i]) {
        balances[users[i]] -= amounts[i];
        totalAmount += amounts[i];
        emit VPBurned(users[i], amounts[i]);
      }
    }

    emit BatchBurnExecuted(nonce, users.length, totalAmount);
  }

  /**
   * @notice Batch mint VP tokens
   */
  function batchMint(
    address[] calldata users,
    uint256[] calldata amounts,
    uint256 nonce,
    bytes calldata signature
  ) external {
    require(users.length == amounts.length, "VP: length mismatch");
    require(users.length > 0, "VP: empty batch");
    require(nonce == batchNonce, "VP: invalid nonce");

    // Verify signature
    bytes32 structHash = keccak256(
      abi.encode(
        BATCH_MINT_TYPEHASH,
        keccak256(abi.encodePacked(users)),
        keccak256(abi.encodePacked(amounts)),
        nonce
      )
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(operators[signer], "VP: invalid signature");

    // Increment nonce
    batchNonce++;

    // Execute mints
    uint256 totalAmount = 0;
    for (uint256 i = 0; i < users.length; i++) {
      if (amounts[i] > 0) {
        balances[users[i]] += amounts[i];
        totalAmount += amounts[i];
        emit VPMinted(users[i], amounts[i]);
      }
    }

    emit BatchMintExecuted(nonce, users.length, totalAmount);
  }

  /**
   * @notice Calculate VP from vDOT
   */
  function calculateVP(
    uint256 vdotAmount
  ) public pure returns (uint256 vpAmount) {
    if (vdotAmount == 0) return 0;
    uint256 sqrtVdot = sqrt(vdotAmount);
    uint256 sqrtPrecision = sqrt(PRECISION);
    vpAmount = sqrtVdot * K * sqrtPrecision;
  }

  /**
   * @notice Square root (Babylonian method)
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
   * @notice Get EIP-712 domain separator
   */
  function domainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }

  /**
   * @notice Emergency withdraw (owner only)
   */
  function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
    require(to != address(0), "VP: invalid recipient");
    vdotToken.safeTransfer(to, amount);
  }
}
