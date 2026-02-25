import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

    return (
        <div className="h-full w-full bg-archive-bg flex flex-col font-serif overflow-hidden">
            <header className="border-b border-archive-border bg-black/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between font-mono">
                    <div className="font-bold text-lg text-archive-text flex items-center gap-2 tracking-widest uppercase">
                        <span className="w-1.5 h-3 bg-archive-accent caret-blink inline-block"></span>
                        AI Sherlock <span className="text-archive-accent opacity-80 text-xs ml-1 font-sans font-bold">V0.1</span>
                    </div>
                    <div className="text-xs text-archive-muted-deep tracking-wider">
                        {user.email}
                    </div>
                </div>
            </header>
            <main className="flex-1 flex flex-col min-h-0">
                {children}
            </main>
        </div>
    );
}
