# MurmurProtocol 合约文档

## 概述

MurmurProtocol 主部署合约，用于设置所有协议组件。这是一个部署辅助合约，帮助记录和跟踪协议部署状态。

**合约文件**: `contracts/MurmurProtocol.sol`

## 核心功能

- **部署记录**: 记录所有协议组件的部署地址
- **状态跟踪**: 跟踪协议部署状态

## 事件

### `ProtocolDeployed(address vpToken, address topicFactory, address topicVault, address aiVerifier, address messageRegistry, address curationModule, address nftMinter)`

协议部署完成时触发。

**参数**:
- `vpToken`: VPToken 合约地址
- `topicFactory`: TopicFactory 合约地址
- `topicVault`: TopicVault 合约地址
- `aiVerifier`: AIScoreVerifier 合约地址
- `messageRegistry`: MessageRegistry 合约地址
- `curationModule`: CurationModule 合约地址
- `nftMinter`: NFTMinter 合约地址

## 说明

- 此合约主要用于部署辅助和状态记录
- 在生产环境中，建议使用工厂模式或部署脚本进行部署
- 合约本身不包含业务逻辑，仅作为部署流程的辅助工具

## 使用场景

1. **部署跟踪**: 记录所有合约的部署地址
2. **状态查询**: 查询协议部署状态
3. **事件日志**: 通过事件记录部署信息

## 注意事项

1. 此合约不包含实际的部署逻辑
2. 实际部署应该使用部署脚本或工厂合约
3. 主要用于开发和测试环境
