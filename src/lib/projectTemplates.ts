// Ready-made project templates for one-click movie creation.
// Pure client-safe data, no server dependencies.

export type ProjectTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  prompt: string;
  artStyle: string;
  voice: string;
  music: string;
  transitions: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
  ageGroup?: string;
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "bedtime",
    name: "Bedtime Story",
    category: "Kids",
    description: "Soft, soothing narrative to help children fall asleep.",
    prompt: "A gentle bedtime story about a small animal on a quiet nighttime adventure that ends with peaceful sleep.",
    artStyle: "watercolor storybook, soft pastel palette",
    voice: "warm female, slow calming pace",
    music: "bedtime",
    transitions: "fade",
    aspectRatio: "16:9",
    ageGroup: "3-7",
  },
  {
    id: "bible",
    name: "Bible Story",
    category: "Faith",
    description: "Retelling of a classic Bible story for family viewing.",
    prompt: "A short, faithful retelling of a Bible story suitable for children, ending with a clear moral lesson.",
    artStyle: "cinematic biblical illustration, warm golden light",
    voice: "reverent male narrator",
    music: "emotional",
    transitions: "crossfade",
    aspectRatio: "16:9",
    ageGroup: "6-12",
  },
  {
    id: "educational",
    name: "Educational Lesson",
    category: "Education",
    description: "Explains a concept clearly with visual examples.",
    prompt: "An engaging educational lesson that explains a concept step by step with concrete examples.",
    artStyle: "clean flat illustration with diagrams",
    voice: "clear friendly teacher voice",
    music: "calm",
    transitions: "cut",
    aspectRatio: "16:9",
  },
  {
    id: "moral",
    name: "Moral Story",
    category: "Kids",
    description: "Short story that ends with a moral lesson.",
    prompt: "A short moral story for children with a clear lesson at the end about honesty, kindness or courage.",
    artStyle: "colorful children's book illustration",
    voice: "warm storyteller",
    music: "happy",
    transitions: "fade",
    aspectRatio: "16:9",
    ageGroup: "5-10",
  },
  {
    id: "science",
    name: "Science Explainer",
    category: "Education",
    description: "Explains a science topic with clear visuals.",
    prompt: "A science explainer video that breaks down a natural phenomenon into simple, visual steps.",
    artStyle: "modern infographic, vibrant accents",
    voice: "curious enthusiastic narrator",
    music: "adventure",
    transitions: "slide",
    aspectRatio: "16:9",
  },
  {
    id: "history",
    name: "History Documentary",
    category: "Education",
    description: "A short documentary about a historical event or figure.",
    prompt: "A short history documentary that presents a historical event or person with vivid narration.",
    artStyle: "cinematic historical painting style",
    voice: "authoritative documentary narrator",
    music: "emotional",
    transitions: "dissolve",
    aspectRatio: "16:9",
  },
  {
    id: "nursery",
    name: "Nursery Rhyme",
    category: "Kids",
    description: "Classic-style nursery rhyme with a sing-along ending.",
    prompt: "A cheerful nursery rhyme story ending with a repeatable, rhyming song for young children.",
    artStyle: "cute cartoon nursery style",
    voice: "playful child-friendly voice",
    music: "happy",
    transitions: "fade",
    aspectRatio: "1:1",
    ageGroup: "2-6",
  },
  {
    id: "adventure",
    name: "Kids Adventure",
    category: "Kids",
    description: "Exciting adventure story for kids.",
    prompt: "An exciting adventure story for children where a young hero discovers courage while exploring a new world.",
    artStyle: "vivid animated adventure illustration",
    voice: "energetic narrator",
    music: "adventure",
    transitions: "slide",
    aspectRatio: "16:9",
    ageGroup: "6-11",
  },
  {
    id: "language",
    name: "Language Learning",
    category: "Education",
    description: "Short story used to teach vocabulary in a target language.",
    prompt: "A short story designed to teach basic vocabulary, repeating key words in context.",
    artStyle: "friendly clean illustration with labels",
    voice: "clear teacher pace",
    music: "calm",
    transitions: "cut",
    aspectRatio: "16:9",
  },
];

export function findTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}