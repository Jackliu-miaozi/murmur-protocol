const fs = require("fs");
const path = require("path");

/**
 * 验证二进制文件路径是否正确
 */
function main() {
  const nodePath = path.resolve(__dirname, '../node/polkadot-sdk/target/release/revive-dev-node');
  const adapterPath = path.resolve(__dirname, '../node/polkadot-sdk/target/release/eth-rpc');

  console.log("🔍 Verifying binary paths...\n");
  console.log("─".repeat(60));

  // Check revive-dev-node
  console.log("Substrate Node:");
  console.log("  Path:", nodePath);
  if (fs.existsSync(nodePath)) {
    const stats = fs.statSync(nodePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
    console.log("  ✅ File exists");
    console.log("  Size:", sizeMB, "MB");
    console.log("  Executable:", isExecutable ? "✅ Yes" : "❌ No (may need: chmod +x)");
  } else {
    console.log("  ❌ File NOT found");
    console.log("  💡 You may need to compile it:");
    console.log("     cd node/polkadot-sdk");
    console.log("     cargo build --release --bin revive-dev-node");
  }

  console.log("");

  // Check eth-rpc
  console.log("ETH RPC Adapter:");
  console.log("  Path:", adapterPath);
  if (fs.existsSync(adapterPath)) {
    const stats = fs.statSync(adapterPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
    console.log("  ✅ File exists");
    console.log("  Size:", sizeMB, "MB");
    console.log("  Executable:", isExecutable ? "✅ Yes" : "❌ No (may need: chmod +x)");
  } else {
    console.log("  ❌ File NOT found");
    console.log("  💡 You may need to compile it:");
    console.log("     cd node/polkadot-sdk");
    console.log("     cargo build --release -p pallet-revive-eth-rpc --bin eth-rpc");
  }

  console.log("─".repeat(60));
  
  if (fs.existsSync(nodePath) && fs.existsSync(adapterPath)) {
    console.log("\n✅ All binary files found! Configuration is ready.");
  } else {
    console.log("\n⚠️  Some binary files are missing. Please compile them first.");
  }
}

main();
