# AIScoreVerifier 合约文档

## 概述

AIScoreVerifier 验证 AI 服务对消息强度分数的签名。使用 EIP-712 标准进行签名验证，确保消息的 AI 强度分数来自可信的 AI 服务。

**合约文件**: `contracts/AIScoreVerifier.sol`

## 核心功能

- **签名验证**: 验证 AI 服务对消息强度分数的签名
- **EIP-712 标准**: 使用 EIP-712 标准进行结构化数据签名
- **时间戳验证**: 确保签名在有效时间窗口内
- **回退模式**: 当 AI 服务不可用时，可以使用默认分数

## 签名验证流程

1. AI 服务计算消息的强度分数（0-1，缩放至 1e18）
2. AI 服务使用私钥对以下数据进行签名：
   - `contentHash`: 消息内容哈希
   - `length`: 消息长度
   - `aiScore`: AI 强度分数
   - `timestamp`: 时间戳
3. 合约验证签名是否来自授权的验证者地址
4. 检查时间戳是否在有效窗口内（默认 10 分钟）

## EIP-712 类型哈希

```
AIScore(bytes32 contentHash,uint256 length,uint256 aiScore,uint256 timestamp)
```

## 状态变量

```solidity
address public verifier;                     // AI 验证者地址
bytes32 public DOMAIN_SEPARATOR;            // EIP-712 域分隔符
bytes32 public constant TYPE_HASH;           // 类型哈希
uint256 public signatureValidityWindow = 600;  // 签名有效期窗口（默认 600 秒）
bool public fallbackModeEnabled = false;    // 回退模式是否启用
uint256 public defaultScore = 5e17;         // 默认分数（0.5）
```

## 主要函数

### `verifyScore(bytes32 contentHash, uint256 length, uint256 aiScore, uint256 timestamp, bytes memory signature) external view returns (bool isValid)`

验证 AI 签名。

**参数**:
- `contentHash`: 消息内容哈希
- `length`: 消息长度
- `aiScore`: AI 强度分数（0-1，缩放至 1e18）
- `timestamp`: 时间戳
- `signature`: AI 服务签名

**返回**: 签名是否有效

**验证流程**:
1. 检查分数范围（0-1e18）
2. 如果启用回退模式且未提供签名，检查分数是否等于默认分数
3. 验证验证者地址已设置
4. 检查时间戳是否在有效窗口内
5. 使用 EIP-712 标准验证签名
6. 检查签名者是否为授权的验证者

### `setVerifier(address _verifier) external onlyOwner`

设置 AI 验证者地址。

**参数**:
- `_verifier`: 验证者地址

**权限**: 仅所有者可调用

### `setValidityWindow(uint256 _window) external onlyOwner`

设置签名有效期窗口。

**参数**:
- `_window`: 窗口时间（秒，60-3600）

**权限**: 仅所有者可调用

**说明**: 窗口时间必须在 60 秒到 3600 秒之间

### `setFallbackMode(bool _enabled, uint256 _defaultScore) external onlyOwner`

启用/禁用回退模式。

**参数**:
- `_enabled`: 是否启用回退模式
- `_defaultScore`: 默认分数（0-1e18）

**权限**: 仅所有者可调用

**说明**: 
- 当回退模式启用时，如果未提供签名，将使用默认分数
- 默认分数必须在 0-1e18 范围内

## 事件

### `VerifierUpdated(address indexed oldVerifier, address indexed newVerifier)`

验证者地址更新时触发。

### `ValidityWindowUpdated(uint256 oldWindow, uint256 newWindow)`

签名有效期窗口更新时触发。

### `FallbackModeUpdated(bool enabled, uint256 defaultScore)`

回退模式更新时触发。

## EIP-712 域

```solidity
{
  "name": "MurmurProtocol",
  "version": "1",
  "chainId": <chainId>,
  "verifyingContract": <contractAddress>
}
```

## 使用示例

```solidity
// 验证 AI 签名
bool isValid = aiVerifier.verifyScore(
    contentHash,
    length,
    aiScore,
    timestamp,
    signature
);

// 设置验证者
aiVerifier.setVerifier(newVerifierAddress);

// 启用回退模式
aiVerifier.setFallbackMode(true, 5e17);  // 默认分数 0.5
```

## 安全考虑

1. **签名验证**: 使用 EIP-712 标准确保签名不可伪造
2. **时间戳验证**: 防止重放攻击
3. **权限控制**: 只有所有者可以更新配置
4. **回退模式**: 在 AI 服务不可用时提供备用方案

## 注意事项

1. 验证者地址必须安全保管私钥
2. 签名有效期窗口应该根据实际需求设置
3. 回退模式应该谨慎使用，仅在紧急情况下启用
4. 默认分数应该设置为合理的值（通常为 0.5）
