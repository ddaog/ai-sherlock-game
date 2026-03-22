"use client";

import { useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import type { StorySource } from "@/lib/stories/store";
import { 
  Save, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  FileText,
  Layout,
  Search,
  Database,
  Info,
  Clock,
  ChevronLeft
} from "lucide-react";

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
  const [success, setSuccess] = useState(false);

  const [id, setId] = useState(initialData?.id || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [isFree, setIsFree] = useState(initialData?.isFree || false);

  const [activeTab, setActiveTab] = useState<"config" | "display" | "evidence" | "embeddings">("config");

  const [config, setConfig] = useState(JSON.stringify(initialData?.config || {}, null, 2));
  const [display, setDisplay] = useState(JSON.stringify(initialData?.display || {}, null, 2));
  const [evidence, setEvidence] = useState(JSON.stringify(initialData?.evidence || [], null, 2));
  const [embeddings, setEmbeddings] = useState(JSON.stringify(initialData?.embeddings || [], null, 2));

  const isStaticStory = !isNew && initialSource === "static";
  const isDbOverride = !isNew && initialSource === "db" && initialHasStaticFallback;

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

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

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin/stories");
        router.refresh();
      }, 1000);
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

  const tabs = [
    { id: "config", label: "Logic Config", icon: Database },
    { id: "display", label: "UI Design", icon: Layout },
    { id: "evidence", label: "Evidence Data", icon: FileText },
    { id: "embeddings", label: "AI Search", icon: Search },
  ] as const;

  return (
    <div className="space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Notifications */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-5 rounded-2xl flex gap-4 items-center text-red-700 dark:text-red-400 shadow-sm">
          <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-xl">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          </div>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-5 rounded-2xl flex gap-4 items-center text-emerald-700 dark:text-emerald-400 shadow-sm">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          </div>
          <p className="text-sm font-bold">Scenario configuration updated successfully!</p>
        </div>
      )}

      {/* Source Banner */}
      {isStaticStory && (
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 p-5 rounded-2xl flex gap-4 items-start text-amber-800 dark:text-amber-300 shadow-sm">
          <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
            <Info className="w-5 h-5 flex-shrink-0" />
          </div>
          <div className="text-sm leading-relaxed">
            <p className="font-black uppercase tracking-wider text-[11px]">System Read-only Source</p>
            <p className="font-medium opacity-80 mt-0.5">This scenario originates from the core filesystem. Saving changes will instantiate a database version which overrides the original.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Basic Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-2">
              Metadata
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-3">Unique Identifier</label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  disabled={!isNew}
                  className="w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-5 py-3.5 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono text-blue-600 dark:text-blue-400"
                  placeholder="case_id_001"
                />
                {!isNew && <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 mt-3 px-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> ID is locked after creation.</p>}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-3">Display Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all focus:border-blue-500 shadow-sm"
                  placeholder="Enter scenario name..."
                />
              </div>

              <div className="pt-4">
                <label className="flex items-center gap-4 cursor-pointer group p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all">
                  <div className={`w-12 h-7 rounded-full transition-all relative ${isFree ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isFree}
                      onChange={(e) => setIsFree(e.target.checked)}
                    />
                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${isFree ? 'translate-x-6' : ''}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-900 dark:text-white transition-colors">
                      Free Access
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase">Public availability</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 dark:bg-blue-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-200 dark:shadow-none relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 transition-transform group-hover:scale-110 group-hover:-rotate-12 duration-700">
              <Database className="w-32 h-32" />
            </div>
            <h3 className="text-lg font-black mb-4 flex items-center gap-2 relative z-10">
              <Info className="w-5 h-5" /> Editor Guide
            </h3>
            <ul className="space-y-4 relative z-10">
              {[
                { title: "Logic", desc: "Define rules and win conditions." },
                { title: "UI", desc: "Manage reveal timing, scene detail, and profile md sources." },
                { title: "Data", desc: "Populate clues and evidence strings." },
                { title: "Vector", desc: "Input AI-ready search embeddings." }
              ].map((item) => (
                <li key={item.title} className="text-sm flex flex-col gap-0.5">
                  <span className="font-black uppercase tracking-widest text-[10px] opacity-70">{item.title}</span>
                  <span className="font-bold">{item.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* JSON Editors Card */}
        <div className="lg:col-span-2 flex flex-col min-h-[650px]">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-[32px] shadow-sm shadow-slate-200/50 dark:shadow-none flex flex-col flex-1 overflow-hidden transition-all">
            <div className="flex items-center border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-8 py-5 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                    activeTab === tab.id 
                      ? "border-blue-600 text-blue-600 bg-white dark:bg-zinc-900" 
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-blue-600" : "text-slate-400"}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 p-0 relative group">
              {activeTab === "display" && (
                <div className="mx-6 mt-6 rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/80 dark:bg-blue-500/5 px-5 py-4 text-[12px] text-slate-700 dark:text-zinc-300 shadow-sm">
                  <p className="font-black uppercase tracking-[0.18em] text-[10px] text-blue-600 dark:text-blue-400">
                    Display JSON Hints
                  </p>
                  <p className="mt-2 leading-relaxed">
                    `ASCII_SCENE.summary`, `ASCII_SCENE.details`, `ASCII_SCENE.queryHints`,
                    `ASCII_SCENE.layout`, `ASCII_CHARACTERS[].sourceMd`, `ASCII_CHARACTERS[].queryHints`
                    를 사용하면 공간 레이아웃, 노출 시점, md 기반 초상화를 admin에서 직접 관리할 수 있습니다.
                  </p>
                </div>
              )}
              <div className="absolute top-4 right-6 text-[10px] font-black text-slate-300 dark:text-zinc-700 uppercase tracking-widest z-10">
                JSON Content
              </div>
              <textarea
                value={
                  activeTab === "config" ? config :
                  activeTab === "display" ? display :
                  activeTab === "evidence" ? evidence :
                  embeddings
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (activeTab === "config") setConfig(val);
                  else if (activeTab === "display") setDisplay(val);
                  else if (activeTab === "evidence") setEvidence(val);
                  else setEmbeddings(val);
                }}
                spellCheck={false}
                className="w-full h-full min-h-[550px] p-8 text-[13px] font-mono bg-transparent text-slate-800 dark:text-zinc-200 resize-none outline-none leading-relaxed selection:bg-blue-100 dark:selection:bg-blue-900/50"
                placeholder="// Enter JSON formatted content here..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-zinc-800 p-6 z-40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push("/admin/stories")}
              className="group flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors font-bold text-sm"
            >
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Back
            </button>
            {!isNew && !isStaticStory && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-black text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all disabled:opacity-50 uppercase tracking-widest"
              >
                <Trash2 className="w-4 h-4" />
                {isDbOverride ? "Reset Override" : "Purge Data"}
              </button>
            )}
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/admin/stories")}
              className="px-8 py-3 text-sm font-black text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-2xl transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-3 px-10 py-3 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-all shadow-xl shadow-blue-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.15em]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {loading ? "Processing..." : "Commit Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
