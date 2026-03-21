import { redirect } from 'next/navigation';
import { Link } from '@/lib/i18n/routing';
import { isAdminUser } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import DebugTrigger from './DebugTrigger';

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Protect the (app) routes
    if (!user) {
        redirect('/login');
    }

    const canAccessAdmin = isAdminUser(user);

    return (
        <div className="h-full w-full bg-archive-bg flex flex-col font-serif overflow-hidden">
            <header className="border-b border-archive-border bg-black/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between font-mono">
                    <DebugTrigger userId={user.id}>
                        <div className="font-bold text-lg text-archive-text flex items-center tracking-widest uppercase">
                            <span className="w-1.5 h-3 bg-archive-accent caret-blink inline-block mr-2"></span>
                            AI Sherlock <span className="text-archive-accent opacity-80 text-xs ml-1 font-sans font-bold mt-1">V0.1</span>
                        </div>
                    </DebugTrigger>
                    <div className="flex items-center gap-4">
                        {canAccessAdmin ? (
                            <Link
                                href="/admin/stories"
                                className="text-[11px] tracking-[0.24em] uppercase border border-archive-accent/60 px-3 py-2 text-archive-accent hover:bg-archive-accent hover:text-white transition-colors"
                            >
                                Admin
                            </Link>
                        ) : null}
                        <div className="text-xs text-archive-muted-deep tracking-wider">
                            {user.email}
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 flex flex-col min-h-0">
                {children}
            </main>
        </div>
    );
}
