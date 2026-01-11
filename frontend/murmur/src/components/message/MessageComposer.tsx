"use client";

import { useState } from "react";
import { Button, Textarea, Card } from "@/components/ui";
import { useMessageRegistry, useMessageCost, useVPToken } from "@/lib/hooks";
import { uploadMessageContent, storeHashMapping } from "@/lib/ipfs";
import { parseEther, keccak256, toBytes } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { CONTRACTS, ABIS } from "@/lib/contracts";

interface MessageComposerProps {
  topicId: bigint;
  onMessagePosted?: () => void;
}

// AIScoreVerifier ABI (minimal, for verifyScore function)
const AIScoreVerifierABI = [
  {
    name: "verifyScore",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "contentHash", type: "bytes32" },
      { name: "length", type: "uint256" },
      { name: "aiScore", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Helper to extract detailed error message from viem errors
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Try to extract revert reason from viem error
    const errorString = error.toString();
    
    // Check for common revert reasons
    if (errorString.includes("invalid AI signature") || errorString.includes("invalid AI signature")) {
      return "AI 签名验证失败。可能是 Chain ID 不匹配或时间戳过期。";
    }
    if (errorString.includes("topic not live")) {
      return "Topic 状态不是 Live，无法发布消息。";
    }
    if (errorString.includes("topic has expired")) {
      return "Topic 已过期，无法发布消息。";
    }
    if (errorString.includes("insufficient VP")) {
      return "VP 余额不足，无法支付消息成本。";
    }
    if (errorString.includes("invalid timestamp") || errorString.includes("invalid timestamp")) {
      return "时间戳无效，签名可能已过期。请重试。";
    }
    if (errorString.includes("合约调用将失败") || errorString.includes("交易失败")) {
      return error.message;
    }
    
    // Try to extract revert reason from error message
    const revertMatch = errorString.match(/revert\s+(.+?)(?:\n|$)/i);
    if (revertMatch) {
      return `合约调用失败: ${revertMatch[1]}`;
    }
    
    // Return original error message
    return error.message || errorString;
  }
  return "未知错误，请查看控制台获取详细信息。";
}

// Diagnostic function to check all validation steps
async function diagnosePostMessage(
  publicClient: any,
  topicId: bigint,
  contentHash: `0x${string}`,
  length: bigint,
  aiScore: bigint,
  timestamp: bigint,
  signature: `0x${string}`,
  userAddress: `0x${string}`,
) {
  console.log("🔍 开始诊断 postMessage 验证步骤...\n");
  
  const issues: string[] = [];
  
  try {
    // Step 1: Check contentHash
    console.log("1️⃣  检查 contentHash...");
    if (contentHash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      issues.push("❌ contentHash 为空");
    } else {
      console.log("   ✅ contentHash 有效");
    }
    
    // Step 2: Check length
    console.log("2️⃣  检查 length...");
    if (length === 0n) {
      issues.push("❌ length 为 0");
    } else {
      console.log(`   ✅ length: ${length.toString()}`);
    }
    
    // Step 3: Check topic status
    console.log("3️⃣  检查 Topic 状态...");
    try {
      const topic = await publicClient.readContract({
        address: CONTRACTS.TopicFactory,
        abi: ABIS.TopicFactory,
        functionName: "getTopic",
        args: [topicId],
      });
      console.log("   Topic status:", topic.status.toString(), "(0=Draft, 1=Live, 2=Closed, 3=Minted, 4=Settled)");
      if (topic.status !== 1n) {
        issues.push(`❌ Topic 状态不是 Live (当前: ${topic.status.toString()})`);
      } else {
        console.log("   ✅ Topic 状态为 Live");
      }
      
      // Check if expired
      const isExpired = await publicClient.readContract({
        address: CONTRACTS.TopicFactory,
        abi: ABIS.TopicFactory,
        functionName: "isExpired",
        args: [topicId],
      });
      if (isExpired) {
        issues.push("❌ Topic 已过期");
      } else {
        console.log("   ✅ Topic 未过期");
      }
    } catch (e) {
      issues.push(`❌ 无法读取 Topic 状态: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // Step 4: Check AI signature verification
    console.log("4️⃣  检查 AI 签名验证...");
    try {
      const isValid = await publicClient.readContract({
        address: CONTRACTS.AIScoreVerifier,
        abi: AIScoreVerifierABI,
        functionName: "verifyScore",
        args: [contentHash, length, aiScore, timestamp, signature],
      });
      if (!isValid) {
        issues.push("❌ AI 签名验证失败");
      } else {
        console.log("   ✅ AI 签名验证通过");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("   AI 签名验证错误:", errorMsg);
      if (errorMsg.includes("invalid timestamp")) {
        issues.push("❌ 时间戳无效（可能已过期）");
      } else if (errorMsg.includes("invalid score range")) {
        issues.push("❌ AI 分数超出有效范围");
      } else {
        issues.push(`❌ AI 签名验证错误: ${errorMsg}`);
      }
    }
    
    // Step 5: Check VP balance
    console.log("5️⃣  检查 VP 余额...");
    try {
      const vpBalance = await publicClient.readContract({
        address: CONTRACTS.VPToken,
        abi: ABIS.VPToken,
        functionName: "balanceOf",
        args: [userAddress],
      });
      
      const messageCost = await publicClient.readContract({
        address: CONTRACTS.MessageRegistry,
        abi: ABIS.MessageRegistry,
        functionName: "calculateMessageCost",
        args: [topicId, length, aiScore],
      });
      
      console.log(`   VP 余额: ${vpBalance.toString()}`);
      console.log(`   消息成本: ${messageCost.toString()}`);
      
      if (vpBalance < messageCost) {
        issues.push(`❌ VP 余额不足 (需要: ${messageCost.toString()}, 拥有: ${vpBalance.toString()})`);
      } else {
        console.log("   ✅ VP 余额充足");
      }
    } catch (e) {
      issues.push(`❌ 无法检查 VP 余额: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // Step 6: Check timestamp validity
    console.log("6️⃣  检查时间戳有效性...");
    try {
      const block = await publicClient.getBlock({ blockTag: "latest" });
      const currentTime = BigInt(block.timestamp);
      const timeDiff = currentTime - timestamp;
      const validityWindow = 600n; // 10 minutes
      
      console.log(`   当前区块时间: ${currentTime.toString()}`);
      console.log(`   签名时间戳: ${timestamp.toString()}`);
      console.log(`   时间差: ${timeDiff.toString()} 秒`);
      console.log(`   有效窗口: ${validityWindow.toString()} 秒`);
      
      if (currentTime < timestamp) {
        issues.push("❌ 时间戳在未来（无效）");
      } else if (timeDiff > validityWindow) {
        issues.push(`❌ 时间戳已过期 (超过 ${validityWindow.toString()} 秒)`);
      } else {
        console.log("   ✅ 时间戳在有效窗口内");
      }
    } catch (e) {
      issues.push(`❌ 无法检查时间戳: ${e instanceof Error ? e.message : String(e)}`);
    }
    
  } catch (e) {
    issues.push(`❌ 诊断过程出错: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  console.log("\n📋 诊断结果:");
  if (issues.length === 0) {
    console.log("   ✅ 所有验证步骤通过，应该可以成功发布消息");
  } else {
    console.log("   ❌ 发现以下问题:");
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }
  
  return issues;
}

export function MessageComposer({
  topicId,
  onMessagePosted,
}: MessageComposerProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { postMessage, isPending } = useMessageRegistry();
  const { vpBalanceRaw } = useVPToken();

  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate message cost based on content length
  // Using a default AI score of 0.5 (50%) for preview
  const defaultAiScore = parseEther("0.5");
  const { cost, costRaw } = useMessageCost(
    topicId,
    BigInt(content.length),
    defaultAiScore,
  );

  const canAfford = vpBalanceRaw ? vpBalanceRaw >= (costRaw ?? 0n) : false;

  const handleSubmit = async () => {
    if (!content.trim() || !address) return;

    setIsPosting(true);
    setError(null);

    try {
      // 1. Upload content to IPFS
      const ipfsHash = await uploadMessageContent({
        content: content.trim(),
        author: address,
        timestamp: Date.now(),
      });

      // 2. Create content hash
      const contentHash = keccak256(toBytes(ipfsHash));

      // 3. Store mapping for later retrieval
      storeHashMapping(contentHash, ipfsHash);

      // 4. Get AI score (mock for now - in production, call AI service)
      // For demo: calculate a simple score based on content length
      // In production, this would come from an AI service
      const mockAiScore = Math.min(0.5 + (content.length / 1000) * 0.5, 1.0); // Simple heuristic: 0.5-1.0 based on length
      const aiScore = parseEther(mockAiScore.toString());
      
      // Get current block timestamp from chain to ensure validity
      // IMPORTANT: Get fresh timestamp right before generating signature
      // The contract checks: block.timestamp >= timestamp && block.timestamp <= timestamp + validityWindow (600s)
      let blockTimestamp: bigint;
      if (publicClient) {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        blockTimestamp = BigInt(block.timestamp);
        console.log("📊 Block timestamp:", blockTimestamp.toString());
      } else {
        // Fallback: use current time - 10 seconds to ensure it's <= block.timestamp
        blockTimestamp = BigInt(Math.floor(Date.now() / 1000) - 10);
        console.warn("⚠️ No publicClient, using fallback timestamp");
      }
      
      // Use block timestamp (or slightly before to account for processing time)
      // This ensures: block.timestamp >= timestamp (always true since we use <= block.timestamp)
      // And: block.timestamp <= timestamp + validityWindow (true as long as timestamp is recent)
      // Use current block timestamp (not subtracting) to maximize validity window
      const timestamp = blockTimestamp;
      console.log("📝 Using timestamp:", timestamp.toString());
      console.log("   Validity window: 600 seconds (10 minutes)");

      // 5. Generate AI signature via API
      console.log("🔐 Generating AI signature...");
      const signatureResponse = await fetch("/api/ai-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentHash,
          length: content.length.toString(),
          aiScore: aiScore.toString(),
          timestamp: timestamp.toString(),
        }),
      });

      if (!signatureResponse.ok) {
        const errorData = await signatureResponse.json();
        throw new Error(`Failed to generate AI signature: ${errorData.error}`);
      }

      const { signature } = (await signatureResponse.json()) as {
        signature: string;
      };
      console.log("✅ AI signature generated");

      // 6. Run diagnostics before posting
      if (publicClient && address) {
        const issues = await diagnosePostMessage(
          publicClient,
          topicId,
          contentHash,
          BigInt(content.length),
          aiScore,
          timestamp,
          signature as `0x${string}`,
          address,
        );
        
        if (issues.length > 0) {
          throw new Error(`验证失败:\n${issues.join("\n")}`);
        }
      }

      // 7. Before posting, check if timestamp is still valid
      // Re-fetch block timestamp to ensure it hasn't expired
      if (publicClient) {
        const latestBlock = await publicClient.getBlock({ blockTag: "latest" });
        const currentBlockTime = BigInt(latestBlock.timestamp);
        const timeSinceSignature = currentBlockTime - timestamp;
        const validityWindow = 600n; // 10 minutes
        
        console.log("⏰ Checking timestamp validity before posting...");
        console.log("   Signature timestamp:", timestamp.toString());
        console.log("   Current block time:", currentBlockTime.toString());
        console.log("   Time since signature:", timeSinceSignature.toString(), "seconds");
        console.log("   Validity window:", validityWindow.toString(), "seconds");
        
        if (timeSinceSignature > validityWindow) {
          throw new Error("时间戳已过期。请重试发布消息。");
        }
        
        if (currentBlockTime < timestamp) {
          // This shouldn't happen, but handle it
          throw new Error("时间戳无效：当前区块时间早于签名时间戳。");
        }
      }

      // 8. Post message to contract
      console.log("📤 Posting message to contract...");
      console.log("   Topic ID:", topicId.toString());
      console.log("   Content Hash:", contentHash);
      console.log("   Length:", content.length);
      console.log("   AI Score:", aiScore.toString());
      console.log("   Timestamp:", timestamp.toString());
      
      await postMessage(
        topicId,
        contentHash,
        BigInt(content.length),
        aiScore,
        timestamp,
        signature as `0x${string}`,
      );

      console.log("✅ Message posted successfully");

      // 9. Clear form and notify
      setContent("");
      onMessagePosted?.();
    } catch (err) {
      console.error("❌ Failed to post message:", err);
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card variant="gradient">
      <h3 className="mb-4 text-lg font-semibold text-white">
        Share Your Thoughts
      </h3>

      <Textarea
        placeholder="What's on your mind? Share your perspective..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        className="mb-4"
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          <p>
            📝 Characters: {content.length}{" "}
            {content.length > 0 && `• Estimated Cost: ${Number(cost).toFixed(2)} VP`}
          </p>
          {!canAfford && content.length > 0 && (
            <p className="mt-1 text-red-400">
              ⚠️ Insufficient VP balance
            </p>
          )}
        </div>

        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={isPosting || isPending}
          disabled={
            !content.trim() ||
            isPosting ||
            isPending ||
            !canAfford ||
            !address
          }
        >
          Post Message
        </Button>
      </div>
    </Card>
  );
}
