import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import StoryEditor from "./StoryEditor";

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  
  let story = null;
  if (id !== "new") {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      notFound();
    }
    story = data;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {id === "new" ? "Add New Scenario" : `Edit Scenario: ${story?.title}`}
        </h2>
      </div>

      <StoryEditor initialData={story} isNew={id === "new"} />
    </div>
  );
}
