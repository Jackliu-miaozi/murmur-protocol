# 测试环境设置指南

## 问题：Transaction is temporarily banned

如果遇到 "Transaction is temporarily banned" 错误，这通常意味着 Polkadot VM 本地节点没有正确启动。

## 解决方案

### 方案 1：启动本地 Polkadot VM 节点（推荐）

1. **检查二进制文件是否存在**：
   ```bash
   ls -la bin/revive-dev-node
   ls -la bin/eth-rpc
   ```

2. **如果二进制文件不存在，需要下载或编译**：
   - 参考项目文档获取 Polkadot VM 二进制文件
   - 或者使用预编译的二进制文件

3. **启动本地节点**（如果需要手动启动）：
   ```bash
   # 在 contracts 目录下
   ./bin/revive-dev-node --dev
   ```

4. **在另一个终端启动 eth-rpc 适配器**：
   ```bash
   ./bin/eth-rpc --dev
   ```

### 方案 2：使用标准 Hardhat 网络（临时方案）

如果 Polkadot VM 节点无法启动，可以临时使用标准 Hardhat 网络进行测试：

```bash
# 使用环境变量禁用 polkavm
npm run test:standard

# 或者直接使用环境变量
DISABLE_POLKAVM=true npm test
```

**注意**：标准 Hardhat 网络可能与 Polkadot EVM 有兼容性差异，某些测试可能会失败。建议优先使用 Polkadot VM 进行完整测试。

### 方案 3：检查节点状态

1. **检查节点是否在运行**：
   ```bash
   # 检查端口 8000 是否被占用
   lsof -i :8000
   ```

2. **检查节点日志**：
   查看是否有错误信息

3. **重启节点**：
   ```bash
   # 杀死现有进程
   pkill -f revive-dev-node
   pkill -f eth-rpc
   
   # 重新启动
   ./bin/revive-dev-node --dev &
   ./bin/eth-rpc --dev &
   ```

## 验证节点是否正常工作

### 方法 1：使用检查脚本（推荐）

```bash
npm run check-node
```

这个脚本会：
- 检查网络连接
- 验证节点是否响应
- 测试简单的合约部署

### 方法 2：运行测试

```bash
npx hardhat test test/01-topic-creation.test.js --network hardhat
```

如果仍然失败，检查：
1. 二进制文件权限：`chmod +x bin/revive-dev-node bin/eth-rpc`
2. 节点日志中的错误信息
3. 网络配置是否正确

## 常见问题

### Q: 为什么需要 Polkadot VM？
A: 合约是为 Polkadot EVM 环境设计的，使用特定的编译器和运行时。标准 Hardhat 网络可能无法完全模拟 Polkadot EVM 的行为。

### Q: 可以跳过 Polkadot VM 吗？
A: 可以临时使用 `hardhatStandard` 网络进行基本功能测试，但完整测试需要 Polkadot VM。

### Q: 如何获取二进制文件？
A: 参考 Polkadot SDK 文档或联系项目维护者获取预编译的二进制文件。
