"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export function OpenGovPanel({ topicId }: { topicId: number }) {
  const utils = api.useUtils();
  const { data: reportData } = api.opengov.getReport.useQuery(
    { topicId },
    { retry: false },
  );
  const { data: topicData } = api.topic.get.useQuery({ id: topicId });

  const [summary, setSummary] = useState("");
  const [sentiment, setSentiment] = useState("0.5");
  const [curatedIds, setCuratedIds] = useState("");
  const [status, setStatus] = useState<"READY" | "APPROVED" | "REJECTED" | "EXECUTED" | "DRAFT">("READY");
  const [proposalId, setProposalId] = useState("");
  const [txHash, setTxHash] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const generateReport = api.opengov.generateReport.useMutation({
    onSuccess: async () => {
      await utils.opengov.getReport.invalidate({ topicId });
      await utils.topic.get.invalidate({ id: topicId });
    },
  });

  const markSubmitted = api.opengov.markSubmitted.useMutation({
    onSuccess: async () => {
      await utils.topic.get.invalidate({ id: topicId });
    },
  });

  const updateStatus = api.opengov.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.topic.get.invalidate({ id: topicId });
    },
  });

  const parsedIds = curatedIds
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
          Report builder
        </p>
        <h1 className="mt-3 text-3xl font-semibold">OpenGov summary</h1>
        <div className="mt-6 grid gap-4">
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Write the community summary"
            className="min-h-[160px] rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          />
          <input
            value={sentiment}
            onChange={(event) => setSentiment(event.target.value)}
            placeholder="Sentiment score (0-1)"
            className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          />
          <input
            value={curatedIds}
            onChange={(event) => setCuratedIds(event.target.value)}
            placeholder="Curated message IDs (comma separated)"
            className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          />
        </div>
        <button
          type="button"
          className="mt-6 rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-strong)]"
          onClick={() => {
            setFormError(null);
            const sentimentValue = Number(sentiment);
            if (Number.isNaN(sentimentValue) || sentimentValue < 0 || sentimentValue > 1) {
              setFormError("Sentiment score must be between 0 and 1.");
              return;
            }
            if (parsedIds.length === 0) {
              setFormError("Provide at least one curated message ID.");
              return;
            }
            generateReport.mutate({
              topicId,
              summary,
              sentimentScore: sentimentValue,
              curatedMessageIds: parsedIds,
            });
          }}
          disabled={generateReport.isPending}
        >
          {generateReport.isPending ? "Generating..." : "Generate report"}
        </button>
        {formError && (
          <p className="mt-3 text-xs text-red-600">{formError}</p>
        )}
      </section>

      <section className="rounded-3xl border border-black/10 bg-white/70 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
          Status
        </p>
        <h2 className="mt-3 text-2xl font-semibold">OpenGov lifecycle</h2>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          Current: {topicData?.openGovStatus ?? "-"}
        </p>
        <div className="mt-4 grid gap-3">
          <input
            value={proposalId}
            onChange={(event) => setProposalId(event.target.value)}
            placeholder="Proposal ID"
            className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          />
          <input
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            placeholder="Tx hash"
            className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
          />
          <button
            type="button"
            className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold"
            onClick={() => markSubmitted.mutate({ topicId, proposalId, txHash })}
            disabled={markSubmitted.isPending}
          >
            {markSubmitted.isPending ? "Submitting..." : "Mark submitted"}
          </button>
        </div>
        <div className="mt-6 border-t border-black/5 pt-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
            Update status
          </p>
          <div className="mt-4 grid gap-3">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "READY" | "APPROVED" | "REJECTED" | "EXECUTED" | "DRAFT")}
              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm"
            >
              <option value="READY">READY</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="EXECUTED">EXECUTED</option>
              <option value="DRAFT">DRAFT</option>
            </select>
            <button
              type="button"
              className="rounded-2xl bg-[var(--color-ink)] px-5 py-3 text-sm font-semibold text-white"
              onClick={() => updateStatus.mutate({ topicId, status, txHash })}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Updating..." : "Update status"}
            </button>
          </div>
        </div>
        {reportData?.report && (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-ink-soft)]">
              Latest report
            </p>
            <p className="mt-3 text-[var(--color-ink)]">
              {reportData.report.summary}
            </p>
            <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
              Sentiment: {reportData.report.sentimentScore}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
