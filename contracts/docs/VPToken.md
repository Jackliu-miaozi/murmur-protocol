# VPToken 合约文档

## 概述

VPToken 是全局 VP（Voice Points）代币合约，基于 ERC-1155 标准。用户可以通过质押 vDOT 来获得 VP，VP 可以在所有主题中使用。

**合约文件**: `contracts/VPToken.sol`

## 核心功能

- **质押 vDOT 获得 VP**: 用户质押 vDOT 代币，根据公式 `VP = 100 * sqrt(vDOT)` 获得 VP
- **提取 vDOT**: 用户可以随时提取已质押的 vDOT
- **VP 销毁**: 在消息发布和点赞时消耗 VP
- **VP 铸造**: 用于退款场景，将 VP 返还给用户

## 角色权限

- `DEFAULT_ADMIN_ROLE`: 管理员角色，可以执行紧急操作
- `BURNER_ROLE`: 可以销毁 VP 的角色（通常授予 MessageRegistry）
- `MINTER_ROLE`: 可以铸造 VP 的角色（通常授予 TopicVault，用于退款）

## 状态变量

```solidity
IERC20 public immutable vdotToken;        // vDOT 代币地址
uint256 public constant K = 100;          // VP 计算常数
mapping(address => uint256) public stakedVdot;  // 用户质押的 vDOT 数量
uint256 public totalStakedVdot;          // 总质押的 vDOT 数量
uint256 private constant VP_TOKEN_ID = 0; // ERC-1155 代币 ID
```

## 主要函数

### `stakeVdot(uint256 amount) external returns (uint256 vpAmount)`

质押 vDOT 以获得 VP。

**参数**:

- `amount`: 要质押的 vDOT 数量

**返回**: 获得的 VP 数量

**计算公式**: `VP = 100 * sqrt(vDOT)`

**流程**:

1. 从用户账户转移 vDOT 到合约
2. 计算对应的 VP 数量
3. 更新用户质押记录
4. 铸造 VP 代币给用户

### `withdrawVdot(uint256 amount) external`

提取质押的 vDOT。

**参数**:

- `amount`: 要提取的 vDOT 数量

**要求**: 用户必须有足够的质押余额

### `balanceOf(address user) external view returns (uint256 balance)`

获取用户的 VP 余额。

**参数**:

- `user`: 用户地址

**返回**: VP 余额

### `burn(address from, uint256 amount) external`

销毁 VP 代币。

**参数**:

- `from`: 要销毁的地址
- `amount`: 要销毁的数量

**权限**: 可由以下角色调用：

- 代币所有者
- 已授权的地址
- `BURNER_ROLE`

### `mint(address to, uint256 amount) external onlyRole(MINTER_ROLE)`

铸造 VP 代币（用于退款）。

**参数**:

- `to`: 接收地址
- `amount`: 铸造数量

**权限**: 仅 `MINTER_ROLE` 可调用

### `calculateVP(uint256 vdotAmount) public pure returns (uint256 vpAmount)`

计算从 vDOT 数量对应的 VP 数量。

**参数**:

- `vdotAmount`: vDOT 数量（18 位小数）

**返回**: VP 数量

**公式**: `VP = K * sqrt(vDOT) * sqrt(PRECISION)`

### `emergencyWithdraw(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE)`

紧急提取 vDOT（仅管理员可调用）。

**参数**:

- `to`: 接收地址
- `amount`: 提取数量

## 事件

### `VdotStaked(address indexed user, uint256 vdotAmount, uint256 vpAmount)`

当用户质押 vDOT 时触发。

### `VdotWithdrawn(address indexed user, uint256 amount)`

当用户提取质押的 vDOT 时触发。

### `VPBurned(address indexed user, uint256 amount)`

当 VP 被销毁时触发。

### `VPMinted(address indexed user, uint256 amount)`

当 VP 被铸造时触发。

## 使用示例

```solidity
// 质押 1000 vDOT
uint256 vpAmount = vpToken.stakeVdot(1000 * 1e18);

// 检查余额
uint256 balance = vpToken.balanceOf(msg.sender);

// 提取质押
vpToken.withdrawVdot(500 * 1e18);
```

## 安全考虑

1. 使用 `SafeERC20` 进行安全的代币转账
2. 使用 `AccessControl` 进行权限管理
3. VP 计算使用整数运算，避免精度损失
4. 支持紧急提取功能，防止资金锁定
