import { createClient } from '@/lib/supabase/server';

const MAX_CREDITS = 99;
const DAILY_REGEN = 33;

export async function getUserCredits(userId: string): Promise<number> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
        .from('credits_daily')
        .select('remaining')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

    if (data) return data.remaining;

    // No record for today — calculate from yesterday
    const { data: prev } = await supabase
        .from('credits_daily')
        .select('remaining')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .single();

    const remaining = prev
        ? Math.min(prev.remaining + DAILY_REGEN, MAX_CREDITS)
        : MAX_CREDITS;

    await supabase.from('credits_daily').upsert({
        user_id: userId,
        date: today,
        remaining,
    });

    return remaining;
}

export async function checkAndDecrementCredits(
    userId: string
): Promise<{ allowed: boolean; remaining: number }> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const credits = await getUserCredits(userId);

    if (credits <= 0) {
        return { allowed: false, remaining: 0 };
    }

    await supabase
        .from('credits_daily')
        .update({ remaining: credits - 1 })
        .eq('user_id', userId)
        .eq('date', today);

    return { allowed: true, remaining: credits - 1 };
}
