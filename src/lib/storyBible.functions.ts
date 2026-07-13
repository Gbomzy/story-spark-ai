import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseBible, mergeBible, type StoryBible } from "@/lib/storyBible";

const IdInput = z.object({ projectId: z.string().uuid() });

export const getStoryBible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("projects")
      .select("story_bible")
      .eq("id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const bible = parseBible((row as { story_bible?: unknown } | null)?.story_bible ?? null);
    return { bible };
  });

const SaveInput = z.object({
  projectId: z.string().uuid(),
  bible: z.object({
    version: z.literal(1).optional(),
    characters: z.array(z.object({
      name: z.string(),
      appearance: z.string().optional(),
      personality: z.string().optional(),
      voiceStyle: z.string().optional(),
    })).optional(),
    world: z.string().optional(),
    theme: z.string().optional(),
    artStyle: z.string().optional(),
    cameraStyle: z.string().optional(),
    voiceStyle: z.string().optional(),
  }),
});

export const saveStoryBible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("projects")
      .select("story_bible")
      .eq("id", data.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    const current = parseBible((existing as { story_bible?: unknown } | null)?.story_bible ?? null);
    const merged: StoryBible = mergeBible(current, {
      ...data.bible,
      version: 1,
    });
    const { error } = await supabase
      .from("projects")
      .update({ story_bible: merged as unknown as never })
      .eq("id", data.projectId)
      .eq("user_id", userId);
    if (error) throw error;
    return { bible: merged };
  });