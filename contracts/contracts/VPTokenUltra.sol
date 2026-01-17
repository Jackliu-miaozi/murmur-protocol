// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

/**
 * @title VPTokenUltra
 * @notice Ultra-minimal VP Token - Core asset custody only
 * @dev Batch operations and VP recovery moved to backend
 */
contract VPTokenUltra is Initializable, EIP712Upgradeable, UUPSUpgradeable {
  using SafeERC20 for IERC20;
  using ECDSA for bytes32;

  address public owner;
  mapping(address => bool) public operators;

  IERC20 public vdotToken;

  // VP calculation constant: VP = k * sqrt(vDOT), where k = 100
  uint256 public constant K = 100;
  uint256 private constant PRECISION = 1e18;

  // Track staked vDOT per user
  mapping(address => uint256) public stakedVdot;
  uint256 public totalStakedVdot;

  // VP Balances (on-chain ledger)
  mapping(address => uint256) public balances;

  // User-specific nonce for withdrawals
  mapping(address => uint256) public userNonce;

  // Backend settlement nonce
  uint256 public settlementNonce;

  // EIP-712 type hashes
  bytes32 private constant WITHDRAW_TYPEHASH =
    keccak256(
      "Withdraw(address user,uint256 vpBurnAmount,uint256 vdotReturn,uint256 nonce)"
    );

  bytes32 private constant SETTLEMENT_TYPEHASH =
    keccak256("Settlement(address[] users,int256[] deltas,uint256 nonce)");

  // Events
  event VdotStaked(address indexed user, uint256 vdotAmount, uint256 vpAmount);
  event VdotWithdrawn(
    address indexed user,
    uint256 vdotAmount,
    uint256 vpBurned
  );
  event SettlementExecuted(uint256 indexed nonce, uint256 totalUsers);
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
    __EIP712_init("MurmurVPToken", "3");
    __UUPSUpgradeable_init();

    require(_vdotToken != address(0), "VP: invalid vdot address");
    require(initialOwner != address(0), "VP: invalid owner address");

    vdotToken = IERC20(_vdotToken);
    owner = initialOwner;
    operators[initialOwner] = true;
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}

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
   * @notice Withdraw vDOT by burning VP (backend-verified)
   * @dev Backend calculates exact exchange rate based on off-chain VP consumption
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

    bytes32 structHash = keccak256(
      abi.encode(WITHDRAW_TYPEHASH, msg.sender, vpBurnAmount, vdotReturn, nonce)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(operators[signer], "VP: invalid signature");

    userNonce[msg.sender]++;
    stakedVdot[msg.sender] -= vdotReturn;
    totalStakedVdot -= vdotReturn;
    balances[msg.sender] -= vpBurnAmount;

    vdotToken.safeTransfer(msg.sender, vdotReturn);
    emit VdotWithdrawn(msg.sender, vdotReturn, vpBurnAmount);
  }

  /**
   * @notice Backend-only: Settle VP balance changes (burns from messages, mints from rewards)
   * @dev Replaces separate batchBurn/batchMint with unified settlement
   * @param users Array of user addresses
   * @param deltas VP changes (negative = burn, positive = mint)
   */
  function settleBalances(
    address[] calldata users,
    int256[] calldata deltas,
    uint256 nonce,
    bytes calldata signature
  ) external {
    require(users.length == deltas.length, "VP: length mismatch");
    require(users.length > 0, "VP: empty settlement");
    require(nonce == settlementNonce, "VP: invalid nonce");

    bytes32 structHash = keccak256(
      abi.encode(
        SETTLEMENT_TYPEHASH,
        keccak256(abi.encodePacked(users)),
        keccak256(abi.encodePacked(deltas)),
        nonce
      )
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = digest.recover(signature);
    require(operators[signer], "VP: invalid signature");

    settlementNonce++;

    for (uint256 i = 0; i < users.length; i++) {
      if (deltas[i] < 0) {
        uint256 burnAmount = uint256(-deltas[i]);
        if (balances[users[i]] >= burnAmount) {
          balances[users[i]] -= burnAmount;
        }
      } else if (deltas[i] > 0) {
        balances[users[i]] += uint256(deltas[i]);
      }
    }

    emit SettlementExecuted(nonce, users.length);
  }

  /**
   * @notice Get VP balance
   */
  function balanceOf(address user) external view returns (uint256) {
    return balances[user];
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

  function domainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }

  function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
    require(to != address(0), "VP: invalid recipient");
    vdotToken.safeTransfer(to, amount);
  }
}
