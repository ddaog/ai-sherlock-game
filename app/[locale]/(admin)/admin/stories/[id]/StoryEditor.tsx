"use client";

import { useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import type { StorySource } from "@/lib/stories/store";

interface StoryRecord {
  id: string;
  title: string;
  isFree: boolean;
  config: unknown;
  display: unknown;
  evidence: unknown;
  embeddings: unknown | null;
}

interface StoryEditorProps {
  initialData: StoryRecord | null;
  initialHasStaticFallback: boolean;
  initialSource: StorySource | null;
  isNew: boolean;
}

export default function StoryEditor({
  initialData,
  initialHasStaticFallback,
  initialSource,
  isNew,
}: StoryEditorProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [id, setId] = useState(initialData?.id || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [isFree, setIsFree] = useState(initialData?.isFree || false);

  const [config, setConfig] = useState(JSON.stringify(initialData?.config || {}, null, 2));
  const [display, setDisplay] = useState(JSON.stringify(initialData?.display || {}, null, 2));
  const [evidence, setEvidence] = useState(JSON.stringify(initialData?.evidence || [], null, 2));
  const [embeddings, setEmbeddings] = useState(JSON.stringify(initialData?.embeddings || [], null, 2));

  const isStaticStory = !isNew && initialSource === "static";
  const isDbOverride = !isNew && initialSource === "db" && initialHasStaticFallback;

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const parsedConfig = JSON.parse(config);
      const parsedDisplay = JSON.parse(display);
      const parsedEvidence = JSON.parse(evidence);
      const parsedEmbeddings = embeddings ? JSON.parse(embeddings) : null;

      const storyData = {
        id,
        title,
        is_free: isFree,
        config: parsedConfig,
        display: parsedDisplay,
        evidence: parsedEvidence,
        embeddings: parsedEmbeddings,
      };

      const res = await fetch("/api/admin/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storyData),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save story");

      router.push("/admin/stories");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save story. Check JSON syntax."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this scenario?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stories/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete story");
      router.push("/admin/stories");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete story");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {isStaticStory ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This scenario comes from <code>data/stories</code>. Saving here will create a
          database override, and delete is disabled for bundled scenarios.
        </div>
      ) : null}

      {isDbOverride ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          This scenario is a database override for a bundled scenario. Deleting it will
          revert the app back to the bundled version.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scenario ID</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={!isNew}
            className="w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
            placeholder="e.g., case_001"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Scenario Title"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isFree"
          checked={isFree}
          onChange={(e) => setIsFree(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="isFree" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Make this scenario free
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Config (CaseConfig)</label>
          <textarea
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Display Config</label>
          <textarea
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Evidence JSON</label>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Embeddings JSON</label>
          <textarea
            value={embeddings}
            onChange={(e) => setEmbeddings(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-zinc-800">
        {!isNew && !isStaticStory && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            {isDbOverride ? "Delete DB Override" : "Delete Scenario"}
          </button>
        )}
        <div className="flex gap-3 ml-auto">
          <button
            onClick={() => router.push("/admin/stories")}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Scenario"}
          </button>
        </div>
      </div>
    </div>
  );
}
