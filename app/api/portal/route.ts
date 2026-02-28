import { CustomerPortal } from "@polar-sh/nextjs";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const GET = CustomerPortal({
    accessToken: process.env.POLAR_ACCESS_TOKEN as string,
    getCustomerId: async (req: NextRequest) => {
        // You can resolve this from your DB where you map Supabase user ID to Polar customer ID
        // If you pass customerExternalId when calling /api/checkout, Polar can link them.
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "";

        // Depending on how you store it, you might need to query your DB
        // e.g., const { data } = await supabase.from('profiles').select('polar_customer_id').eq('id', user.id).single();
        // return data?.polar_customer_id || "";

        // For now, if we use email or external ID, it's safer to read from profiles or returning mapped ID
        return ""; // TODO: Return DB mapped customer ID
    },
    returnUrl: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/stories` : "http://localhost:3000/stories",
    server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});
