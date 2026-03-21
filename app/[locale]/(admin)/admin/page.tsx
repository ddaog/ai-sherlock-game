import { redirect } from "@/lib/i18n/routing";

export default async function AdminIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/admin/stories", locale });
}
