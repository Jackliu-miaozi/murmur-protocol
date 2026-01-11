"use client";

import { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { useVPToken, useVDOTToken } from "@/lib/hooks";
import { useAccount } from "wagmi";

export default function AssetsPage() {
  const { isConnected } = useAccount();
  const {
    vpBalance,
    stakedVdot,
    stakeVdot,
    withdrawVdot,
    calculateVP,
    isLoading: vpLoading,
    isPending: vpPending,
  } = useVPToken();
  const { vdotBalance, isLoading: vdotLoading } = useVDOTToken();

  const [stakeAmount, setStakeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate VP preview for stake amount
  const stakeVPPreview = stakeAmount
    ? calculateVP(stakeAmount)
    : 0n;

  const handleStake = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) return;

    setIsStaking(true);
    setError(null);
    setSuccess(null);

    try {
      await stakeVdot(stakeAmount);
      setSuccess(`Successfully staked ${stakeAmount} vDOT!`);
      setStakeAmount("");
    } catch (err) {
      console.error("Stake failed:", err);
      setError(err instanceof Error ? err.message : "Failed to stake vDOT");
    } finally {
      setIsStaking(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return;

    setIsWithdrawing(true);
    setError(null);
    setSuccess(null);

    try {
      await withdrawVdot(withdrawAmount);
      setSuccess(`Successfully withdrew ${withdrawAmount} vDOT!`);
      setWithdrawAmount("");
    } catch (err) {
      console.error("Withdraw failed:", err);
      setError(err instanceof Error ? err.message : "Failed to withdraw vDOT");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleMaxStake = () => {
    setStakeAmount(vdotBalance);
  };

  const handleMaxWithdraw = () => {
    setWithdrawAmount(stakedVdot);
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <span className="text-6xl">🔐</span>
        <h2 className="mt-4 text-2xl font-bold text-white">
          Connect Your Wallet
        </h2>
        <p className="mt-2 text-gray-400">
          You need to connect your wallet to manage your assets
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">My Assets</h1>
          <p className="mt-2 text-gray-400">
            Manage your vDOT and VP tokens
          </p>
        </div>

        {/* Balance Overview */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card variant="gradient" className="text-center">
            <p className="text-sm text-gray-400">vDOT Balance</p>
            <p className="mt-2 text-3xl font-bold text-white">
              {vdotLoading ? "..." : Number(vdotBalance).toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Available to stake</p>
          </Card>

          <Card variant="gradient" className="text-center">
            <p className="text-sm text-gray-400">Staked vDOT</p>
            <p className="mt-2 text-3xl font-bold text-purple-400">
              {vpLoading ? "..." : Number(stakedVdot).toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Locked in VPToken</p>
          </Card>

          <Card variant="gradient" className="text-center">
            <p className="text-sm text-gray-400">VP Balance</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {vpLoading ? "..." : Number(vpBalance).toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Voice Points</p>
          </Card>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-500/20 p-4 text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg bg-green-500/20 p-4 text-green-400">
            {success}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          {/* Stake Section */}
          <Card>
            <h2 className="mb-4 text-xl font-semibold text-white">
              Stake vDOT → Get VP
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              Stake your vDOT to receive VP (Voice Points). Formula: VP = 100 ×
              √vDOT
            </p>

            <div className="space-y-4">
              <div className="relative">
                <Input
                  label="Amount to Stake"
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  step="0.01"
                />
                <button
                  type="button"
                  onClick={handleMaxStake}
                  className="absolute right-3 top-9 text-sm text-purple-400 hover:text-purple-300"
                >
                  MAX
                </button>
              </div>

              {stakeAmount && Number(stakeAmount) > 0 && (
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-sm text-gray-400">You will receive:</p>
                  <p className="text-lg font-bold text-purple-400">
                    ~{(Number(stakeVPPreview) / 1e18).toFixed(2)} VP
                  </p>
                </div>
              )}

              <Button
                variant="primary"
                onClick={handleStake}
                isLoading={isStaking || vpPending}
                disabled={
                  !stakeAmount ||
                  Number(stakeAmount) <= 0 ||
                  Number(stakeAmount) > Number(vdotBalance) ||
                  isStaking ||
                  vpPending
                }
                className="w-full"
              >
                Stake vDOT
              </Button>
            </div>
          </Card>

          {/* Withdraw Section */}
          <Card>
            <h2 className="mb-4 text-xl font-semibold text-white">
              Withdraw vDOT
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              Withdraw your staked vDOT. Your VP will remain in your account.
            </p>

            <div className="space-y-4">
              <div className="relative">
                <Input
                  label="Amount to Withdraw"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  step="0.01"
                />
                <button
                  type="button"
                  onClick={handleMaxWithdraw}
                  className="absolute right-3 top-9 text-sm text-purple-400 hover:text-purple-300"
                >
                  MAX
                </button>
              </div>

              <Button
                variant="secondary"
                onClick={handleWithdraw}
                isLoading={isWithdrawing || vpPending}
                disabled={
                  !withdrawAmount ||
                  Number(withdrawAmount) <= 0 ||
                  Number(withdrawAmount) > Number(stakedVdot) ||
                  isWithdrawing ||
                  vpPending
                }
                className="w-full"
              >
                Withdraw vDOT
              </Button>
            </div>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-white">
            About VP (Voice Points)
          </h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span>💎</span>
              <span>
                VP is your global voice power in Murmur Protocol. Stake vDOT to
                get VP.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>📝</span>
              <span>
                VP is consumed when you create topics, post messages, or like
                messages.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>🔄</span>
              <span>
                When a topic is minted as NFT, all VP spent in that topic is
                refunded to participants!
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>📊</span>
              <span>
                VP formula: VP = 100 × √vDOT. For example, 1000 vDOT gives you
                ~3162 VP.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
