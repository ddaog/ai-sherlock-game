import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { redirect } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/server";

function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.trim().toLowerCase());
}

export async function requireAdminPage(locale: string): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  if (!isAdminEmail(user.email)) {
    redirect({ href: "/stories", locale });
  }

  return user;
}

type AdminApiResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export async function requireAdminApi(): Promise<AdminApiResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user };
}
