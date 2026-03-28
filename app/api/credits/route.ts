import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserCredits } from "@/lib/credits";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const remaining = await getUserCredits(user.id);
    return NextResponse.json({ remaining });
}
