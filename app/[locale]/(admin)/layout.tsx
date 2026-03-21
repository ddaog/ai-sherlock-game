import { ReactNode } from "react";
import { Link } from "@/lib/i18n/routing";
import { requireAdminPage } from "@/lib/admin";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireAdminPage(locale);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">
      <header className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-4 px-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
        <nav className="flex gap-4">
          <Link href="/admin/stories" className="text-sm font-medium hover:underline">
            Stories
          </Link>
          <span className="text-sm font-medium text-gray-500">Users</span>
        </nav>
      </header>
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <div className="mb-4 text-xs text-gray-500 dark:text-zinc-400">
          Signed in as {user.email}
        </div>
        {children}
      </main>
    </div>
  );
}
