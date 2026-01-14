# VDOTToken 合约文档

## 概述

VDOTToken 是一个简单的 ERC-20 vDOT 代币合约，用于测试 Murmur Protocol。这是一个最小实现，在生产环境中应使用现有的流动性质押衍生品代币。

**合约文件**: `contracts/VDOTToken.sol`

## 核心功能

- **ERC-20 标准代币**: 实现标准的 ERC-20 接口
- **代币铸造**: 仅所有者可以铸造代币（用于测试）
- **代币销毁**: 用户可以销毁自己持有的代币

## 状态变量

```solidity
string public name = "Voted DOT";
string public symbol = "vDOT";
uint8 public decimals = 18;
```

## 主要函数

### `constructor(address initialOwner)`

构造函数，初始化代币并铸造初始供应量。

**参数**:
- `initialOwner`: 初始所有者地址（将铸造 1,000,000 vDOT）

**行为**: 
- 设置代币名称为 "Voted DOT"
- 设置代币符号为 "vDOT"
- 铸造 1,000,000 vDOT 给初始所有者

### `mint(address to, uint256 amount) external onlyOwner`

铸造代币（仅用于测试）。

**参数**:
- `to`: 接收地址
- `amount`: 铸造数量

**权限**: 仅所有者可调用

### `burn(uint256 amount) external`

销毁代币。

**参数**:
- `amount`: 销毁数量

**要求**: 调用者必须有足够的余额

## 使用示例

```solidity
// 铸造代币（仅所有者）
vdotToken.mint(userAddress, 1000 * 1e18);

// 销毁代币
vdotToken.burn(500 * 1e18);
```

## 注意事项

1. **测试用途**: 此合约仅用于测试，生产环境应使用真实的流动性质押衍生品代币
2. **权限控制**: 铸造功能仅所有者可用，防止无限增发
3. **标准兼容**: 完全兼容 ERC-20 标准，可与所有标准钱包和 DEX 集成
