"use client";

import { useCallback, useState } from "react";
import { api } from "@/trpc/react";
import { decodeEventLog, type Hex } from "viem";
import { usePublicClient } from "wagmi";

export function MintPanel({ topicId }: { topicId: number }) {
  const utils = api.useUtils();
  const { data: topic } = api.topic.get.useQuery({ id: topicId });
  const publicClient = usePublicClient();
  const signMint = api.settlement.signMintNFT.useMutation();
  const recordMint = api.settlement.recordMintedNFT.useMutation({
    onSuccess: async () => {
      await utils.topic.get.invalidate({ id: topicId });
    },
  });

  const [tokenId, setTokenId] = useState("");
  const [txHash, setTxHash] = useState("");
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const canMint = topic?.status === "LANDED";

  const resolveTokenId = useCallback(async () => {
    if (!txHash) {
      setResolveError("Provide a transaction hash first.");
      return;
    }

    if (!publicClient) {
      setResolveError("Wallet RPC not ready.");
      return;
    }

    setResolveError(null);
    setIsResolving(true);

    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as Hex,
      });

      const mintLog = receipt.logs.find(
        (log) =>
          log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      );

      if (!mintLog) {
        throw new Error("Transfer event not found.");
      }

      const decoded = decodeEventLog({
        abi: [
          {
            type: "event",
            name: "Transfer",
            inputs: [
              { indexed: true, name: "from", type: "address" },
              { indexed: true, name: "to", type: "address" },
              { indexed: true, name: "tokenId", type: "uint256" },
            ],
          },
        ],
        data: mintLog.data,
        topics: mintLog.topics as [Hex, ...Hex[]],
      });

      if (decoded.args.tokenId) {
        setTokenId(decoded.args.tokenId.toString());
      } else {
        throw new Error("Token ID not found in event.");
      }
    } catch (error) {
      setResolveError(
        error instanceof Error ? error.message : "Failed to parse transaction.",
      );
    } finally {
      setIsResolving(false);
    }
  }, [publicClient, txHash]);

  return (
    <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
        Mint
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Mint memory NFT</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        Topic must be LANDED. Signature will be issued for your wallet.
      </p>
      <div className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
        <p>Status: {topic?.status ?? "-"}</p>
        <p>IPFS hash: {topic?.ipfsHash ?? "-"}</p>
      </div>
      <div className="mt-6 grid gap-4">
        <button
          type="button"
          className="rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white"
          onClick={() => signMint.mutate({ topicId })}
          disabled={signMint.isPending || !canMint}
        >
          {signMint.isPending ? "Signing..." : "Get signature"}
        </button>
        <input
          value={tokenId}
          onChange={(event) => setTokenId(event.target.value)}
          placeholder="Minted token ID"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          disabled={!canMint}
        />
        <button
          type="button"
          className="rounded-2xl border border-black/10 px-6 py-3 text-sm font-semibold"
          onClick={() =>
            recordMint.mutate({
              topicId,
              tokenId: Number(tokenId || 0),
              txHash: txHash || undefined,
            })
          }
          disabled={recordMint.isPending || !canMint || !tokenId}
        >
          {recordMint.isPending ? "Recording..." : "Record minted NFT"}
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        <input
          type="text"
          value={txHash}
          onChange={(event) => setTxHash(event.target.value)}
          placeholder="Paste mint tx hash"
          className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
        />
        <button
          type="button"
          className="rounded-2xl border border-black/10 px-4 py-2 text-xs font-semibold"
          onClick={resolveTokenId}
          disabled={!canMint || isResolving}
        >
          {isResolving ? "Resolving..." : "Auto-detect token ID"}
        </button>
        {resolveError && (
          <p className="text-xs text-red-600">{resolveError}</p>
        )}
        <p className="text-xs text-[var(--color-ink-soft)]">
          Use the mint transaction hash to parse the Transfer event and fill the
          token ID automatically.
        </p>
      </div>
      {!canMint && (
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
          Minting unlocks after the topic is LANDED.
        </p>
      )}
      {signMint.data && (
        <div className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-xs">
          <p>Nonce: {signMint.data.nonce}</p>
          <p className="break-all">Signature: {signMint.data.signature}</p>
        </div>
      )}
      {recordMint.data && (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 p-4 text-xs text-[var(--color-ink-soft)]">
          <p>{recordMint.data.note}</p>
        </div>
      )}
    </section>
  );
}
