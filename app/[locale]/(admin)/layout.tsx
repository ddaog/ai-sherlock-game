import { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";
import { requireAdminPage } from "@/lib/admin";
import { 
  BookOpen, 
  Users, 
  Settings, 
  LogOut,
  ChevronRight,
  ShieldCheck
} from "lucide-react";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireAdminPage(locale);

  const navItems = [
    { name: "Scenarios", href: "/admin/stories", icon: BookOpen },
    { name: "Users", href: "#", icon: Users, disabled: true },
    { name: "Settings", href: "#", icon: Settings, disabled: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex text-slate-900 dark:text-zinc-100 selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden md:flex flex-col sticky top-0 h-screen z-30 shadow-sm">
        <div className="p-6 flex items-center justify-between">
          <Link href="/admin/stories" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-200 dark:shadow-none transition-transform group-hover:scale-105">
              S
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tight leading-none">Sherlock</span>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Admin</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Management</span>
          </div>
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                item.disabled 
                  ? "text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-60" 
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:text-blue-600 dark:hover:text-blue-400 group"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-4 h-4 transition-colors ${!item.disabled ? "group-hover:text-blue-600 dark:group-hover:text-blue-400" : ""}`} />
                {item.name}
              </div>
              {!item.disabled && <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />}
            </Link>
          ))}
        </nav>

        <div className="p-4">
          <div className="flex items-center gap-3.5 px-3 py-3 mb-3 bg-slate-50 dark:bg-zinc-800/30 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-sm">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">
                {user.email?.split('@')[0]}
              </p>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
                  Admin
                </span>
              </div>
            </div>
          </div>
          <Link 
            href="/" 
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            <span className="text-slate-400 dark:text-zinc-500">Workspace</span>
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-zinc-700" />
            <span className="text-blue-600 dark:text-blue-400">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
            <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">System Live</span>
          </div>
        </header>
        
        <main className="flex-1 p-8 overflow-y-auto scroll-smooth">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
