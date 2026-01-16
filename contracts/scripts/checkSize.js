const fs = require('fs');
const path = require('path');

const CONTRACTS = [
  'MessageRegistry',
  'CurationModule',
  'TopicFactory',
  'TopicVault',
  'NFTMinter',
  'VPToken',
  'AIScoreVerifier',
  'VDOTToken'
];

const MAX_SIZE = 24576; // 24KB (EIP-170 limit)

console.log('\n=== Contract Size Report ===\n');

CONTRACTS.forEach(contractName => {
  try {
    const artifactPath = path.join(__dirname, '..', 'artifacts-pvm', 'contracts', `${contractName}.sol`, `${contractName}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    // Remove '0x' prefix and calculate size
    const bytecode = artifact.deployedBytecode || artifact.bytecode;
    const size = (bytecode.length - 2) / 2; // Each byte is 2 hex chars
    const percentage = (size / MAX_SIZE * 100).toFixed(2);
    
    const status = size > MAX_SIZE ? '❌ TOO LARGE' : '✅ OK';
    
    console.log(`${contractName}:`);
    console.log(`  Size: ${size} bytes (${percentage}% of limit)`);
    console.log(`  Status: ${status}`);
    console.log('');
  } catch (error) {
    console.log(`${contractName}: ⚠️  Not found or error`);
    console.log('');
  }
});

console.log(`Limit: ${MAX_SIZE} bytes (24 KB)\n`);
