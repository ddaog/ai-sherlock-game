import { createClient } from '../supabase/server';

export type Plan = 'free' | 'lestrade' | 'watson' | 'sherlock';

export interface Entitlements {
    plan: Plan;
    dailyQuestionsLimit: number;
    hintsPerStory: number;
    canAccessSpecialStory: boolean;
}

const PLAN_FEATURES: Record<Plan, Entitlements> = {
    free: {
        plan: 'free',
        dailyQuestionsLimit: 99,
        hintsPerStory: 0,
        canAccessSpecialStory: false,
    },
    lestrade: {
        plan: 'lestrade',
        dailyQuestionsLimit: 99,
        hintsPerStory: 1,
        canAccessSpecialStory: false,
    },
    watson: {
        plan: 'watson',
        dailyQuestionsLimit: Infinity,
        hintsPerStory: 1,
        canAccessSpecialStory: false,
    },
    sherlock: {
        plan: 'sherlock',
        dailyQuestionsLimit: Infinity,
        hintsPerStory: 3,
        canAccessSpecialStory: true,
    },
};

export async function getUserPlan(userId: string): Promise<Plan> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        return 'free';
    }

    // Check if subscription is active
    if (data.status !== 'active') {
        return 'free';
    }

    // Optionally check current_period_end here
    const isExpired = data.current_period_end && new Date(data.current_period_end).getTime() < Date.now();
    if (isExpired) {
        return 'free';
    }

    return (data.plan as Plan) || 'free';
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
    const plan = await getUserPlan(userId);
    return PLAN_FEATURES[plan];
}
