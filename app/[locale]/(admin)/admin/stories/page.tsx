import { Link } from "@/lib/i18n/routing";
import { Metadata } from "next";
import { getAllAdminStories } from "@/lib/stories/store";
import { 
  Plus, 
  Search, 
  ExternalLink, 
  CheckCircle2, 
  Database,
  FileCode2,
  AlertCircle,
  Clock
} from "lucide-react";

export const metadata: Metadata = {
  title: "Admin - Scenarios",
};

export default async function AdminStoriesPage() {
  const stories = await getAllAdminStories();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Scenarios</h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-2 font-medium">Manage and edit your game scenarios and evidence library.</p>
        </div>
        <Link
          href="/admin/stories/new"
          className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 dark:shadow-none active:scale-95 group"
        >
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
          Create New Scenario
        </Link>
      </div>

      <div className="bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
        <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        </div>
        <div className="text-sm text-blue-900/80 dark:text-blue-200/80 leading-relaxed">
          <span className="font-bold text-blue-900 dark:text-blue-300">Architecture Tip:</span> Bundled scenarios are loaded from <code className="bg-blue-100/50 dark:bg-blue-500/20 px-1.5 py-0.5 rounded font-bold text-blue-800 dark:text-blue-200 text-[11px]">data/stories</code>. 
          Modifying them here creates a high-priority <span className="underline decoration-blue-300 underline-offset-4 font-bold">Database Override</span> that persists your changes without touching the source code.
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/50 rounded-3xl overflow-hidden shadow-sm shadow-slate-200/50 dark:shadow-none transition-all">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="py-5 px-8 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Scenario Detail</th>
                <th className="py-5 px-6 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-center">Pricing</th>
                <th className="py-5 px-6 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-center">Source Type</th>
                <th className="py-5 px-6 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Registration</th>
                <th className="py-5 px-8 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-right">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
              {stories && stories.length > 0 ? (
                stories.map((story) => (
                  <tr key={story.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors group">
                    <td className="py-6 px-8">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {story.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-tighter transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-500">
                            {story.id}
                          </code>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-6">
                      <div className="flex justify-center">
                        {story.isFree ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-[11px] font-black text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Free Access
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 text-[11px] font-black text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 uppercase tracking-wider">
                            Premium Only
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-6 px-6 text-center">
                      <div className="flex justify-center">
                        {story.source === "static" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 text-[11px] font-black text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 uppercase tracking-wider">
                            <FileCode2 className="w-3.5 h-3.5" />
                            Static File
                          </span>
                        ) : story.hasStaticFallback ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 text-[11px] font-black text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 uppercase tracking-wider">
                            <Database className="w-3.5 h-3.5" />
                            Override
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 text-[11px] font-black text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 uppercase tracking-wider">
                            <Database className="w-3.5 h-3.5" />
                            Cloud DB
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-6 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-500">
                        <Clock className="w-3.5 h-3.5 opacity-60" />
                        <span className="text-sm font-bold">
                          {story.createdAt
                            ? new Date(story.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                            : "Pre-installed"}
                        </span>
                      </div>
                    </td>
                    <td className="py-6 px-8 text-right">
                      <Link
                        href={`/admin/stories/${story.id}`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all font-bold group/btn"
                      >
                        <span className="text-sm">Configure</span>
                        <ExternalLink className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="p-6 bg-slate-50 dark:bg-zinc-800 rounded-3xl">
                        <Search className="w-10 h-10 text-slate-300 dark:text-zinc-600" />
                      </div>
                      <p className="text-slate-500 dark:text-zinc-500 font-bold text-lg">No scenarios in your library.</p>
                      <Link href="/admin/stories/new" className="text-sm text-blue-600 dark:text-blue-400 font-black hover:underline uppercase tracking-widest">
                        Initialize your first scenario
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
