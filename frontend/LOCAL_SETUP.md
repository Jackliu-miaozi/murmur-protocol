# Local Chain Configuration

## Environment Setup

```env
# Local Development Chain
NEXT_PUBLIC_CHAIN_RPC=http://127.0.0.1:8545
NEXT_PUBLIC_CHAIN_ID=1337

# Contract Addresses (Update after deployment)
NEXT_PUBLIC_VPTOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_AI_VERIFIER_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_TOPIC_FACTORY_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
NEXT_PUBLIC_TOPIC_VAULT_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
NEXT_PUBLIC_CURATION_MODULE_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
NEXT_PUBLIC_MESSAGE_REGISTRY_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
NEXT_PUBLIC_NFT_MINTER_ADDRESS=0x0165878A594ca255338adfa4d48449f69242Eb8F

# IPFS Configuration (Pinata)
PINATA_API_KEY=72ba648f478b3d27ceb6
PINATA_API_SECRET=6e48c9658929eb55abc7dd31990b607d9fe4459e0a35db80abcc2986e0618a0f
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI0NjgxYzExNi1lNTQ2LTQxOWUtOGVlOS1kZjFjZTZiZjk3OGYiLCJlbWFpbCI6Imx6eXVqbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiNzJiYTY0OGY0NzhiM2QyN2NlYjYiLCJzY29wZWRLZXlTZWNyZXQiOiI2ZTQ4Yzk2NTg5MjllYjU1YWJjN2RkMzE5OTBiNjA3ZDlmZTQ0NTllMGEzNWRiODBhYmNjMjk4NmUwNjE4YTBmIiwiZXhwIjoxNzk5NTYyNDg1fQ.gilYHyNrgbm3c02ZKhFMBDI2mx8HH4S2ANqPunkJGI4

# AI Service Signing Key (Generate a new one for security)
AI_SIGNER_PRIVATE_KEY=0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

## Quick Start

### 1. Start Local Blockchain

```bash
cd contracts
npx hardhat node
```

This will start a local Ethereum node at `http://127.0.0.1:8545` with Chain ID 1337.

### 2. Deploy Contracts

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract addresses and update:
- `frontend/.env.local` 
- `frontend/lib/contracts/addresses.ts`

### 3. Configure MetaMask

1. Open MetaMask
2. Add Network:
   - Network Name: `Localhost`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `1337`
   - Currency Symbol: `ETH`

3. Import Test Account:
   - Use one of the private keys from Hardhat node output
   - Or use the default: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Contract Addresses

After deploying, you should see output like:

```
VPToken deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
TopicFactory deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
...
```

Update these addresses in `frontend/lib/contracts/addresses.ts`:

```typescript
export const CONTRACT_ADDRESSES = {
  VPToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  AIScoreVerifier: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  TopicFactory: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  // ... other addresses
} as const
```

## Testing

1. Connect wallet (MetaMask)
2. You should see your test account balance
3. Try staking vDOT
4. Create a topic
5. Post messages
6. Like messages

## Troubleshooting

### "Nonce too high" error
Reset MetaMask account:
Settings → Advanced → Clear activity tab data

### "Insufficient funds" error
Make sure your test account has ETH from Hardhat node

### "Contract not deployed" error
1. Check contract addresses are correct
2. Verify contracts are deployed: `npx hardhat console --network localhost`
3. Redeploy if needed

### Frontend won't connect to wallet
1. Check MetaMask is on localhost network
2. Refresh page and try reconnecting
3. Check browser console for errors
