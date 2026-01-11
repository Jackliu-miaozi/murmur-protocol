const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🔄 Restarting local PolkaVM node...\n");

// Find and kill existing node processes
try {
  console.log("1. Stopping existing node processes...");
  
  // Kill revive-dev-node
  try {
    execSync("pkill -f revive-dev-node", { stdio: "ignore" });
    console.log("   ✅ Stopped revive-dev-node");
  } catch (e) {
    console.log("   ℹ️  No revive-dev-node process found");
  }

  // Kill eth-rpc
  try {
    execSync("pkill -f eth-rpc", { stdio: "ignore" });
    console.log("   ✅ Stopped eth-rpc");
  } catch (e) {
    console.log("   ℹ️  No eth-rpc process found");
  }

  // Wait a bit for processes to fully stop
  execSync("sleep 2", { stdio: "ignore" });
} catch (error) {
  console.log("   ⚠️  Error stopping processes:", error.message);
}

// Check if binary files exist
const nodeBinary = path.join(__dirname, "../bin/revive-dev-node");
const rpcBinary = path.join(__dirname, "../bin/eth-rpc");

if (!fs.existsSync(nodeBinary)) {
  console.error("❌ Node binary not found:", nodeBinary);
  console.error("   Please ensure PolkaVM binaries are installed");
  process.exit(1);
}

if (!fs.existsSync(rpcBinary)) {
  console.error("❌ RPC adapter binary not found:", rpcBinary);
  console.error("   Please ensure PolkaVM binaries are installed");
  process.exit(1);
}

// Make binaries executable
try {
  fs.chmodSync(nodeBinary, 0o755);
  fs.chmodSync(rpcBinary, 0o755);
  console.log("2. ✅ Binary files are executable");
} catch (error) {
  console.log("   ⚠️  Could not set executable permissions");
}

// Start node in background
console.log("\n3. Starting revive-dev-node...");
console.log("   This will create a fresh database (--dev mode)\n");

try {
  // Start node in background
  const nodeProcess = require("child_process").spawn(nodeBinary, ["--dev"], {
    detached: true,
    stdio: "ignore",
  });
  nodeProcess.unref();
  console.log("   ✅ Node started (PID:", nodeProcess.pid, ")");
} catch (error) {
  console.error("   ❌ Failed to start node:", error.message);
  process.exit(1);
}

// Wait a bit for node to initialize
console.log("\n4. Waiting for node to initialize...");
execSync("sleep 5", { stdio: "ignore" });

// Start eth-rpc adapter
console.log("\n5. Starting eth-rpc adapter...");
try {
  const rpcProcess = require("child_process").spawn(rpcBinary, ["--dev"], {
    detached: true,
    stdio: "ignore",
  });
  rpcProcess.unref();
  console.log("   ✅ RPC adapter started (PID:", rpcProcess.pid, ")");
} catch (error) {
  console.error("   ❌ Failed to start RPC adapter:", error.message);
  process.exit(1);
}

// Wait for RPC to be ready
console.log("\n6. Waiting for RPC to be ready...");
execSync("sleep 3", { stdio: "ignore" });

// Test connection
console.log("\n7. Testing connection...");
try {
  const { ethers } = require("hardhat");
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const blockNumber = await provider.getBlockNumber();
  console.log("   ✅ Connected! Current block:", blockNumber);
} catch (error) {
  console.error("   ⚠️  Connection test failed:", error.message);
  console.log("   The node may still be starting. Please wait a few more seconds.");
}

console.log("\n✅ Node restart complete!");
console.log("\n📝 Next steps:");
console.log("   1. Wait 10-20 seconds for the node to fully initialize");
console.log("   2. Try your transaction again");
console.log("   3. If issues persist, check node logs");
console.log("\n💡 Tip: You can check node status with:");
console.log("   npx hardhat run scripts/checkBalance.js --network localNode");
