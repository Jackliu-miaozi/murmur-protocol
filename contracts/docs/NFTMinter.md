# NFTMinter 合约文档

## 概述

NFTMinter 为已关闭的主题铸造 NFT 记忆，并触发 VP 退款。只有在该主题中发布过消息的用户才能铸造 NFT。

**合约文件**: `contracts/NFTMinter.sol`

## 核心功能

- **NFT 铸造**: 为已关闭的主题铸造 ERC-721 NFT
- **元数据生成**: 自动生成符合 OpenSea 标准的元数据
- **VP 退款触发**: 铸造 NFT 后自动触发 VP 退款
- **权限控制**: 只有在该主题中发布过消息的用户才能铸造

## 角色权限

- `DEFAULT_ADMIN_ROLE`: 管理员角色，可以更新配置
- `OPERATOR_ROLE`: 操作员角色

## NFT 元数据

```solidity
struct NFTMetadata {
    uint256 topicId;      // 主题 ID
    bytes32 topicHash;    // 主题哈希
    bytes32 curatedHash;  // 精选消息集合哈希
    string version;       // 版本号
    uint256 mintedAt;    // 铸造时间
    address mintedBy;    // 铸造者地址
}
```

## 状态变量

```solidity
ITopicFactory public topicFactory;           // TopicFactory 合约
ICurationModule public curationModule;       // CurationModule 合约
IMessageRegistry public messageRegistry;      // MessageRegistry 合约
ITopicVault public topicVault;               // TopicVault 合约

uint256 private _tokenIdCounter;             // NFT 计数器
mapping(uint256 => uint256) public topicToTokenId;  // 主题到 NFT 的映射
mapping(uint256 => NFTMetadata) public tokenMetadata;  // NFT 元数据

string public constant VERSION = "1.0.0";    // 版本号
string public baseImageURI = "https://murmur.protocol/nft/";  // 基础图片 URI
```

## 主要函数

### `mintNfts(uint256 topicId) external nonReentrant returns (uint256 tokenId)`

为已关闭的主题铸造 NFT。

**参数**:
- `topicId`: 主题 ID

**返回**: 铸造的 NFT token ID

**要求**:
- 主题必须是 Closed 状态
- 主题未已铸造 NFT
- 调用者必须在该主题中发布过消息

**流程**:
1. 验证主题状态和权限
2. 如果精选消息未最终确定，自动最终确定
3. 获取精选消息集合哈希
4. 铸造 NFT
5. 存储元数据
6. 标记主题为已铸造
7. 触发 VP 退款

### `getMetadata(uint256 tokenId) external view returns (NFTMetadata memory metadata)`

获取 NFT 元数据。

**参数**:
- `tokenId`: Token ID

**返回**: NFT 元数据

### `tokenURI(uint256 tokenId) public view override returns (string memory)`

获取 token URI（用于 OpenSea 兼容性）。

**参数**:
- `tokenId`: Token ID

**返回**: 包含 JSON 元数据的 Token URI

**格式**: `data:application/json;base64,{base64_encoded_json}`

**JSON 结构**:
```json
{
  "name": "Murmur Memory #0",
  "description": "A curated memory from Murmur Protocol - Topic 1",
  "attributes": [
    {
      "trait_type": "Topic ID",
      "value": "1"
    },
    {
      "trait_type": "Version",
      "value": "1.0.0"
    },
    {
      "trait_type": "Minted At",
      "display_type": "date",
      "value": 1234567890
    }
  ],
  "image": "https://murmur.protocol/nft/0.png"
}
```

### `setBaseImageURI(string memory newURI) external onlyRole(DEFAULT_ADMIN_ROLE)`

设置基础图片 URI。

**参数**:
- `newURI`: 新的基础 URI

**权限**: 仅 `DEFAULT_ADMIN_ROLE` 可调用

## 事件

### `NFTMinted(uint256 indexed tokenId, uint256 indexed topicId, address indexed minter, bytes32 topicHash, bytes32 curatedHash)`

NFT 被铸造时触发。

### `BaseImageURIUpdated(string newURI)`

基础图片 URI 更新时触发。

## 使用示例

```solidity
// 铸造 NFT
uint256 tokenId = nftMinter.mintNfts(topicId);

// 获取元数据
NFTMetadata memory metadata = nftMinter.getMetadata(tokenId);

// 获取 token URI
string memory uri = nftMinter.tokenURI(tokenId);
```

## NFT 特性

1. **唯一性**: 每个主题只能铸造一个 NFT
2. **权限控制**: 只有在该主题中发布过消息的用户才能铸造
3. **元数据完整性**: 包含主题哈希和精选消息哈希，确保不可篡改
4. **OpenSea 兼容**: 完全兼容 OpenSea 元数据标准

## 安全考虑

1. 使用 `nonReentrant` 防止重入攻击
2. 权限验证确保只有符合条件的用户可以铸造
3. 状态检查确保主题已关闭
4. 自动触发退款，确保用户权益
