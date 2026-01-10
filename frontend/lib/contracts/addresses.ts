// Contract addresses from CONTRACT_ADDRESSES.md
export const CONTRACT_ADDRESSES = {
  VPToken: '0xC530e4cD4933357da902577E78cC7C65C5759e0C',
  AIScoreVerifier: '0xf2D374B77db32284D79FCbf72b0d97d16D031cdf',
  TopicFactory: '0xE07fd4CC631b88aD64d3782A7eCDC1D4c8382b70',
  TopicVault: '0xA758c15e87Da64bac82badd9e03F30D7E18d7677',
  CurationModule: '0x7dEC25311108Fa879c419b15D74272D81f359170',
  MessageRegistry: '0xF090c0b7aF977DCf4decab59a5eeDe1514423332',
  NFTMinter: '0xE86E5e51b57D83c4420c78eB1bd30453cA2C0a8F',
} as const

export const CHAIN_RPC = process.env.NEXT_PUBLIC_CHAIN_RPC || 'wss://rococo-contracts-rpc.polkadot.io'
