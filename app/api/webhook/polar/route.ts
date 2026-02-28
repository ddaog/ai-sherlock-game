import { Webhooks } from "@polar-sh/nextjs";
import { createClient } from "@supabase/supabase-js";

// Uses service role to bypass RLS for webhook updates
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
    onPayload: async (payload) => {
        // Logs for debugging
        console.log("Polar Webhook received:", payload.type);
    },
    onOrderPaid: async (payload) => {
        // Check order payload
        const customerId = payload.data.customerId;
        const externalId = payload.data.customer.externalId; // Supabase User ID passed in checkout

        if (!externalId) {
            console.error("No external ID (Supabase User ID) found on Polar order.");
            return;
        }

        const productId = payload.data.productId;
        let plan = "free";
        if (productId === process.env.NEXT_PUBLIC_POLAR_LESTRADE_ID) plan = "lestrade";
        if (productId === process.env.NEXT_PUBLIC_POLAR_SHERLOCK_ID) plan = "sherlock";
        if (productId === process.env.NEXT_PUBLIC_POLAR_HOLMES_ID) plan = "holmes";

        if (plan === "free") {
            console.warn(`Product ID ${productId} did not match any known tier.`);
        }

        // Upsert the subscription on the Supabase side
        const { error } = await supabaseAdmin
            .from("subscriptions")
            .upsert({
                user_id: externalId,
                plan: plan,
                status: "active",
                polar_customer_id: customerId,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });

        if (error) {
            console.error("Failed to upsert subscription in Supabase:", error);
        } else {
            console.log(`Successfully granted ${plan} plan to user ${externalId}.`);
        }
    },
    onSubscriptionUpdated: async (payload) => {
        const externalId = payload.data.customer.externalId;
        if (!externalId) return;

        const productId = payload.data.productId;
        const status = payload.data.status; // 'active', 'canceled', etc.

        let plan = "free";
        if (productId === process.env.NEXT_PUBLIC_POLAR_LESTRADE_ID) plan = "lestrade";
        if (productId === process.env.NEXT_PUBLIC_POLAR_SHERLOCK_ID) plan = "sherlock";
        if (productId === process.env.NEXT_PUBLIC_POLAR_HOLMES_ID) plan = "holmes";

        const { error } = await supabaseAdmin
            .from("subscriptions")
            .upsert({
                user_id: externalId,
                plan: plan,
                status: status,
                polar_customer_id: payload.data.customerId,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });

        if (error) {
            console.error("Failed to update subscription status in Supabase:", error);
        }
    }
});
