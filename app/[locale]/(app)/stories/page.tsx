import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import StoryGrid from './StoryGrid';

export default async function StoriesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let isPremium = false;
    if (user) {
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('plan, status')
            .eq('user_id', user.id)
            .single();
        isPremium = sub?.status === 'active' && sub?.plan !== 'free';
    }

    // Workaround for next-intl in async Server Components
    const t = await getTranslations('Stories');

    return (
        <div className="max-w-5xl mx-auto px-6 py-12 w-full font-serif text-archive-text flex-1 overflow-y-auto">
            <div className="mb-12 border-b border-archive-border pb-6 flex items-baseline justify-between">
                <h1 className="text-3xl font-black tracking-widest text-archive-text uppercase font-mono drop-shadow-[0_0_10px_rgba(245,245,245,0.2)]">
                    {t('title')}
                </h1>
                <p className="text-archive-muted-deep text-[13px] tracking-wider font-mono hidden md:block">SELECT INVESTIGATION_</p>
            </div>

            <StoryGrid userId={user?.id || ''} isPremium={isPremium} />
        </div>
    );
}
