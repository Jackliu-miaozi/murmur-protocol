#!/bin/bash

echo "🔄 Restarting local PolkaVM node..."

# Kill existing processes
echo "1. Stopping existing processes..."
pkill -f revive-dev-node 2>/dev/null && echo "   ✅ Stopped revive-dev-node" || echo "   ℹ️  No revive-dev-node found"
pkill -f eth-rpc 2>/dev/null && echo "   ✅ Stopped eth-rpc" || echo "   ℹ️  No eth-rpc found"

sleep 2

# Check binaries
if [ ! -f "bin/revive-dev-node" ]; then
  echo "❌ Node binary not found!"
  exit 1
fi

if [ ! -f "bin/eth-rpc" ]; then
  echo "❌ RPC adapter binary not found!"
  exit 1
fi

# Make executable
chmod +x bin/revive-dev-node bin/eth-rpc 2>/dev/null

# Start node in background
echo ""
echo "2. Starting revive-dev-node (--dev mode)..."
nohup ./bin/revive-dev-node --dev > /dev/null 2>&1 &
NODE_PID=$!
echo "   ✅ Node started (PID: $NODE_PID)"

sleep 5

# Start RPC adapter
echo ""
echo "3. Starting eth-rpc adapter..."
nohup ./bin/eth-rpc --dev > /dev/null 2>&1 &
RPC_PID=$!
echo "   ✅ RPC adapter started (PID: $RPC_PID)"

sleep 3

echo ""
echo "✅ Node restart complete!"
echo ""
echo "📝 Please wait 10-20 seconds for the node to fully initialize"
echo "   Then try your transaction again"
