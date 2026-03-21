import { notFound } from "next/navigation";
import { getAdminStoryBundle, type AdminEditableStory } from "@/lib/stories/store";
import StoryEditor from "./StoryEditor";

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  let story: AdminEditableStory | null = null;
  if (id !== "new") {
    const data = await getAdminStoryBundle(id);
    if (!data) {
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

      <StoryEditor
        initialData={story}
        initialHasStaticFallback={story?.hasStaticFallback ?? false}
        initialSource={story?.source ?? null}
        isNew={id === "new"}
      />
    </div>
  );
}
