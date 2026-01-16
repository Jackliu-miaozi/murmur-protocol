# 代理模式重构方案

## 当前问题

根据合约大小检查,以下合约超过了24KB限制:

| 合约名称 | 当前大小 | 超出比例 | 状态 |
|---------|---------|---------|------|
| MessageRegistry | 98,494 bytes | 400.77% | ❌ 严重超标 |
| NFTMinter | 105,177 bytes | 427.97% | ❌ 严重超标 |
| VPToken | 79,702 bytes | 324.31% | ❌ 严重超标 |
| TopicFactory | 60,761 bytes | 247.24% | ❌ 严重超标 |
| CurationModule | 56,623 bytes | 230.40% | ❌ 严重超标 |
| TopicVault | 40,352 bytes | 164.19% | ❌ 超标 |
| VDOTToken | 28,863 bytes | 117.44% | ❌ 超标 |
| AIScoreVerifier | 20,863 bytes | 84.89% | ✅ 符合 |

## 解决方案:采用透明代理模式 (Transparent Proxy Pattern)

我们将使用OpenZeppelin的透明代理模式,这是最安全和广泛使用的代理模式之一。

### 方案优势

1. **可升级性**: 未来可以升级合约逻辑而不改变地址
2. **数据持久性**: 所有状态数据保存在代理合约中
3. **透明性**: 用户和管理员调用分离,避免函数选择器冲突
4. **安全性**: 经过广泛审计的OpenZeppelin实现

## 实施步骤

### 步骤1: 安装OpenZeppelin升级插件

```bash
npm install --save-dev @openzeppelin/hardhat-upgrades
```

### 步骤2: 修改合约使其可升级

需要对每个合约进行以下修改:

#### 2.1 移除构造函数,使用initializer

**之前:**
```solidity
contract MessageRegistry is Ownable, ReentrancyGuard {
    constructor(
        address _topicFactory,
        address _topicVault,
        address _vpToken,
        address _aiVerifier,
        address _curationModule,
        address initialOwner
    ) Ownable(initialOwner) {
        // 初始化代码
    }
}
```

**之后:**
```solidity
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract MessageRegistry is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        address _topicFactory,
        address _topicVault,
        address _vpToken,
        address _aiVerifier,
        address _curationModule,
        address initialOwner
    ) public initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        
        // 初始化代码
    }
}
```

#### 2.2 使用可升级版本的OpenZeppelin合约

替换所有标准合约为可升级版本:
- `Ownable` → `OwnableUpgradeable`
- `ReentrancyGuard` → `ReentrancyGuardUpgradeable`
- `AccessControl` → `AccessControlUpgradeable`
- `ERC20` → `ERC20Upgradeable`

#### 2.3 添加存储间隙 (Storage Gaps)

在每个合约末尾添加:
```solidity
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
```

### 步骤3: 创建部署脚本

创建新的部署脚本使用代理模式:

```javascript
// scripts/deployWithProxy.js
const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // 1. 部署 VDOTToken (代理)
    const VDOTToken = await ethers.getContractFactory("VDOTToken");
    const vdotToken = await upgrades.deployProxy(VDOTToken, [deployer.address], {
        initializer: "initialize",
    });
    await vdotToken.waitForDeployment();
    console.log("VDOTToken proxy deployed to:", await vdotToken.getAddress());

    // 2. 部署 VPToken (代理)
    const VPToken = await ethers.getContractFactory("VPToken");
    const vpToken = await upgrades.deployProxy(VPToken, [
        await vdotToken.getAddress(),
        deployer.address
    ], {
        initializer: "initialize",
    });
    await vpToken.waitForDeployment();
    console.log("VPToken proxy deployed to:", await vpToken.getAddress());

    // 3. 部署 TopicFactory (代理)
    const TopicFactory = await ethers.getContractFactory("TopicFactory");
    const topicFactory = await upgrades.deployProxy(TopicFactory, [
        await vpToken.getAddress(),
        deployer.address
    ], {
        initializer: "initialize",
    });
    await topicFactory.waitForDeployment();
    console.log("TopicFactory proxy deployed to:", await topicFactory.getAddress());

    // ... 继续部署其他合约
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### 步骤4: 配置Hardhat

更新 `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200, // 可以调整以优化合约大小
            },
        },
    },
    // ... 其他配置
};
```

### 步骤5: 进一步优化合约大小

如果使用代理后仍然超标,可以采用以下策略:

#### 5.1 提取库函数

将复杂的计算逻辑提取到库中:

```solidity
// contracts/libraries/HeatCalculator.sol
library HeatCalculator {
    function calculateHeat(
        uint256 messageCount,
        uint256 uniqueUsers,
        uint256 likeCount,
        uint256 vpBurned,
        uint256 elapsed
    ) internal pure returns (uint256) {
        // 复杂的热度计算逻辑
    }
}

// 在MessageRegistry中使用
import "./libraries/HeatCalculator.sol";

contract MessageRegistry is ... {
    using HeatCalculator for *;
    
    function calculateHeat(uint256 topicId) public view returns (uint256) {
        return HeatCalculator.calculateHeat(
            topicMessageCount[topicId],
            topicUniqueUserCount[topicId],
            // ...
        );
    }
}
```

#### 5.2 模块化拆分

对于特别大的合约(如MessageRegistry),可以拆分为多个模块:

```
MessageRegistry (主合约)
├── MessagePostingModule (处理消息发布)
├── MessageLikingModule (处理点赞)
└── MessageQueryModule (处理查询)
```

#### 5.3 优化器设置

调整Solidity编译器优化参数:

```javascript
optimizer: {
    enabled: true,
    runs: 1, // 降低runs值可以减小部署大小,但会增加运行成本
}
```

## 需要修改的合约列表

### 高优先级 (严重超标)
1. ✅ MessageRegistry - 需要拆分模块 + 代理
2. ✅ NFTMinter - 代理模式
3. ✅ VPToken - 代理模式
4. ✅ TopicFactory - 代理模式
5. ✅ CurationModule - 代理模式

### 中优先级 (超标)
6. ✅ TopicVault - 代理模式
7. ✅ VDOTToken - 代理模式

### 低优先级 (已符合)
8. ⚠️ AIScoreVerifier - 可选代理(为了一致性)

## 实施顺序

1. **第一阶段**: 安装依赖和配置
   - 安装 @openzeppelin/hardhat-upgrades
   - 更新 hardhat.config.js

2. **第二阶段**: 转换简单合约
   - VDOTToken
   - AIScoreVerifier
   - TopicVault

3. **第三阶段**: 转换中等复杂度合约
   - VPToken
   - CurationModule
   - TopicFactory

4. **第四阶段**: 转换复杂合约
   - MessageRegistry (可能需要模块化)
   - NFTMinter

5. **第五阶段**: 测试和验证
   - 运行所有测试
   - 检查合约大小
   - 部署到测试网

## 注意事项

1. **存储布局**: 升级时不能改变现有变量的顺序或类型
2. **初始化**: 确保initialize函数只能调用一次
3. **选择器冲突**: 避免在实现合约中定义与代理管理相关的函数
4. **测试**: 充分测试升级流程和初始化逻辑

## 预期结果

使用代理模式后,每个合约的部署字节码将只包含逻辑部分,代理合约本身非常小(约1-2KB),可以轻松满足25KB的限制。

## 下一步行动

1. 我可以帮你安装必要的依赖
2. 逐个转换合约为可升级版本
3. 创建新的部署脚本
4. 运行测试确保功能正常

你想从哪个步骤开始?
