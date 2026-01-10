# Murmur Protocol Frontend

A Next.js frontend application for the Murmur Protocol - a decentralized real-time discussion platform powered by VP tokens on Polkadot.

## Features

- 🔐 **Multi-Wallet Support**: Connect with Polkadot.js, SubWallet, or Talisman
- 💬 **Real-time Discussions**: Participate in time-limited topic discussions
- 🎯 **VP System**: Stake vDOT to get VP (Voice Points) for participation
- 🏆 **Curated Content**: Messages are ranked and curated based on community likes
- 🎨 **NFT Minting**: Topics are minted as permanent NFT records
- 📦 **IPFS Storage**: Decentralized content storage via Pinata
- 🤖 **AI Scoring**: AI-powered message intensity scoring

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Web3**: @polkadot/api, @polkadot/extension-dapp
- **State**: Zustand
- **Storage**: Pinata IPFS
- **AI Service**: EIP-712 signed scoring

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Polkadot wallet extension (Polkadot.js, SubWallet, or Talisman)
- Pinata account for IPFS (credentials provided)

### Installation

1. Clone the repository and navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` and update the values as needed.

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend/
├── app/                      # Next.js App Router pages
│   ├── api/                 # API routes (AI scoring, IPFS)
│   ├── topics/             # Topic pages
│   ├── assets/            # Asset management
│   ├── gallery/           # NFT gallery
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # Reusable UI components
│   ├── wallet/           # Wallet connection
│   ├── topic/            # Topic components
│   └── message/          # Message components
├── lib/
│   ├── contracts/        # Smart contract interactions
│   ├── wallet/           # Wallet utilities
│   ├── ipfs/             # IPFS integration
│   ├── stores/           # Zustand stores
│   └── utils/            # Helper functions
└── types/                # TypeScript types
```

## Key Components

### Wallet Connection

The wallet integration supports multiple Polkadot wallets:
- Polkadot.js Extension
- SubWallet
- Talisman

### Smart Contracts

The app interacts with the following contracts:
- **VPToken**: VP token management
- **TopicFactory**: Topic creation and lifecycle
- **MessageRegistry**: Message posting and likes
- **CurationModule**: Curated message selection
- **NFTMinter**: NFT minting for topics

### IPFS Integration

Content is stored on IPFS via Pinata:
- Topic metadata (title, description)
- Message content
- NFT metadata

### AI Scoring

Messages are scored for expression intensity using:
- EIP-712 signature verification
- Heuristic-based scoring (placeholder for production AI)
- Signature validation on-chain

## Development

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Environment Variables

Required environment variables:

- `NEXT_PUBLIC_CHAIN_RPC`: Polkadot RPC endpoint
- `NEXT_PUBLIC_*_ADDRESS`: Contract addresses
- `PINATA_API_KEY`: Pinata API key
- `PINATA_API_SECRET`: Pinata API secret
- `PINATA_JWT`: Pinata JWT token
- `AI_SIGNER_PRIVATE_KEY`: Private key for AI service signing

## Important Notes

1. **ABI Files**: The contract ABIs are placeholder implementations. Replace with actual compiled ABIs from the contracts directory.

2. **AI Scoring**: The current AI scoring is a simple heuristic. In production, replace with actual AI model integration.

3. **Private Key**: Generate a secure private key for `AI_SIGNER_PRIVATE_KEY` and keep it secret.

4. **Network**: Currently configured for Rococo testnet. Update RPC and contract addresses for other networks.

## License

MIT
