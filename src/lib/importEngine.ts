// Import TXT / MD / DOCX / JSON / ZIP into a project payload.
import JSZip from "jszip";

export interface ImportedProject {
  name: string;
  story?: string;
  characters?: string;
  storyboard?: string;
  voice?: string;
  songs?: string;
  images?: string;
  seo?: string;
  raw?: string;
}

function pickSection(md: string, title: string): string | undefined {
  const re = new RegExp(`##\\s+${title}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const m = md.match(re);
  return m ? m[1].trim() : undefined;
}

function fromMarkdown(md: string, fallbackName: string): ImportedProject {
  const nameMatch = md.match(/^#\s+(.+)$/m);
  return {
    name: nameMatch?.[1]?.trim() || fallbackName,
    story: pickSection(md, "Story"),
    characters: pickSection(md, "Characters"),
    storyboard: pickSection(md, "Storyboard"),
    voice: pickSection(md, "Voice Script") ?? pickSection(md, "Voice"),
    songs: pickSection(md, "Songs"),
    images: pickSection(md, "Image Prompts") ?? pickSection(md, "Images"),
    seo: pickSection(md, "SEO"),
    raw: md,
  };
}

async function fromDocx(file: File): Promise<string> {
  // Extract raw text from DOCX (XML in word/document.xml)
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("Invalid DOCX");
  const xml = await doc.async("string");
  return xml.replace(/<w:p[^>]*>/g, "\n").replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").trim();
}

async function fromZip(file: File): Promise<ImportedProject> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const json = zip.file("project.json");
  if (json) {
    const parsed = JSON.parse(await json.async("string"));
    if (parsed.sections) {
      const sec = (t: string) => parsed.sections.find((s: { title: string }) => s.title === t)?.content;
      return {
        name: parsed.name || file.name,
        story: sec("Story"), characters: sec("Characters"), storyboard: sec("Storyboard"),
        voice: sec("Voice Script"), songs: sec("Songs"), images: sec("Image Prompts"), seo: sec("SEO"),
      };
    }
    return { name: parsed.name || file.name, ...parsed };
  }
  const readme = zip.file("README.md");
  if (readme) return fromMarkdown(await readme.async("string"), file.name);
  throw new Error("ZIP missing project.json or README.md");
}

export async function parseImport(file: File): Promise<ImportedProject> {
  const name = file.name.replace(/\.[^.]+$/, "");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") {
    const j = JSON.parse(await file.text());
    if (j.sections) return fromMarkdown(`# ${j.name || name}\n\n` + j.sections.map((s: { title: string; content: string }) => `## ${s.title}\n\n${s.content}`).join("\n\n"), name);
    return { name: j.name || name, ...j };
  }
  if (ext === "zip")  return fromZip(file);
  if (ext === "docx") { const txt = await fromDocx(file); return { name, story: txt, raw: txt }; }
  if (ext === "md" || ext === "markdown") return fromMarkdown(await file.text(), name);
  return { name, story: await file.text() };
}