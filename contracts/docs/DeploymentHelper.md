# DeploymentHelper 合约文档

## 概述

DeploymentHelper 辅助合约，用于部署有循环依赖关系的 CurationModule 和 MessageRegistry。使用 CREATE2 预计算地址并原子化部署两个合约。

**合约文件**: `contracts/DeploymentHelper.sol`

## 核心功能

- **循环依赖解决**: 解决 CurationModule 和 MessageRegistry 之间的循环依赖
- **CREATE2 地址计算**: 使用 CREATE2 预计算合约地址
- **原子化部署**: 确保两个合约同时部署成功或失败

## 问题背景

CurationModule 和 MessageRegistry 之间存在循环依赖：
- MessageRegistry 需要 CurationModule 地址
- CurationModule 需要 MessageRegistry 地址

使用 CREATE2 可以预计算地址，从而解决这个问题。

## 主要函数

### `computeCurationModuleAddress(address messageRegistry, bytes32 salt) public view returns (address)`

使用 CREATE2 计算 CurationModule 地址。

**参数**:
- `messageRegistry`: MessageRegistry 地址
- `salt`: CREATE2 盐值

**返回**: 计算出的地址

### `computeMessageRegistryAddress(address topicVault, address aiVerifier, address curationModule, bytes32 salt) public view returns (address)`

使用 CREATE2 计算 MessageRegistry 地址。

**参数**:
- `topicVault`: TopicVault 地址
- `aiVerifier`: AIScoreVerifier 地址
- `curationModule`: CurationModule 地址
- `salt`: CREATE2 盐值

**返回**: 计算出的地址

### `deployBoth(address topicVault, address aiVerifier, bytes32 curationSalt, bytes32 messageSalt) public returns (address curationModule, address messageRegistry)`

原子化部署 CurationModule 和 MessageRegistry。

**参数**:
- `topicVault`: TopicVault 地址
- `aiVerifier`: AIScoreVerifier 地址
- `curationSalt`: CurationModule 的 CREATE2 盐值
- `messageSalt`: MessageRegistry 的 CREATE2 盐值

**返回**: 部署的 CurationModule 和 MessageRegistry 地址

**流程**:
1. 使用迭代方法计算地址直到收敛
2. 先部署 CurationModule（使用预计算的 MessageRegistry 地址）
3. 再部署 MessageRegistry（使用已部署的 CurationModule 地址）
4. 验证两个合约地址与预计算地址一致

## 事件

### `CurationModuleDeployed(address indexed curationModule)`

CurationModule 部署时触发。

### `MessageRegistryDeployed(address indexed messageRegistry)`

MessageRegistry 部署时触发。

## 使用示例

```solidity
// 计算地址
address curationAddr = deploymentHelper.computeCurationModuleAddress(
    messageRegistryAddr,
    curationSalt
);

// 部署两个合约
(address curationModule, address messageRegistry) = deploymentHelper.deployBoth(
    topicVault,
    aiVerifier,
    curationSalt,
    messageSalt
);
```

## 注意事项

1. **CREATE2 要求**: 使用 CREATE2 需要确保字节码和盐值一致
2. **地址收敛**: 迭代计算直到地址收敛
3. **原子化**: 确保两个合约同时部署成功或失败
4. **验证**: 部署后验证地址与预计算地址一致

## 安全考虑

1. 使用 CREATE2 确保地址可预测
2. 原子化部署防止部分部署失败
3. 地址验证确保部署正确
