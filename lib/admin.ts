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

function hasAdminRole(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;

  const role = (metadata as { role?: unknown }).role;
  return typeof role === "string" && role.trim().toLowerCase() === "admin";
}

export function isAdminUser(
  user:
    | Pick<User, "email" | "app_metadata" | "user_metadata">
    | null
    | undefined
): boolean {
  if (!user) return false;

  return (
    isAdminEmail(user.email) ||
    hasAdminRole(user.app_metadata) ||
    hasAdminRole(user.user_metadata)
  );
}

function redirectForAdminPage(href: "/login" | "/stories", locale: string): never {
  redirect({ href, locale });
  throw new Error("Unreachable after redirect");
}

export async function requireAdminPage(locale: string): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectForAdminPage("/login", locale);
  }

  if (!isAdminUser(user)) {
    redirectForAdminPage("/stories", locale);
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

  if (!isAdminUser(user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user };
}
