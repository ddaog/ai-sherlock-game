import { Link } from "@/lib/i18n/routing";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Admin - Stories",
};

export default async function AdminStoriesPage() {
  const supabase = createAdminClient();
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, title, is_free, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching stories:", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Scenarios</h2>
        <Link
          href="/admin/stories/new"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add New Scenario
        </Link>
      </div>

      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg border border-gray-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
          <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-gray-100">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6">ID</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Title</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Free</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Created At</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 text-gray-500 dark:text-gray-400">
            {stories && stories.length > 0 ? (
              stories.map((story) => (
                <tr key={story.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-6">{story.id}</td>
                  <td className="px-3 py-4 text-sm">{story.title}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {story.is_free ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Yes</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">No</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {new Date(story.created_at).toLocaleDateString()}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <Link
                      href={`/admin/stories/${story.id}`}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm">
                  No scenarios found. Use the seeding script or add one manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
