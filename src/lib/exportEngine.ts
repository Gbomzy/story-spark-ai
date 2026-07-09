// Universal export engine: PDF, DOCX, TXT, MD, JSON, HTML, ZIP
import { saveAs } from "file-saver";
import JSZip from "jszip";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

export type ExportFormat = "pdf" | "docx" | "txt" | "md" | "json" | "html" | "zip";

export interface ExportSection {
  title: string;
  content: string;
}

export interface ExportBundle {
  name: string;
  sections: ExportSection[];
  meta?: Record<string, unknown>;
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_ ]/gi, "_").trim() || "export";
}

export function toMarkdown(b: ExportBundle): string {
  return `# ${b.name}\n\n` + b.sections.map((s) => `## ${s.title}\n\n${s.content ?? ""}\n`).join("\n");
}

export function toTxt(b: ExportBundle): string {
  return `${b.name}\n${"=".repeat(b.name.length)}\n\n` +
    b.sections.map((s) => `${s.title}\n${"-".repeat(s.title.length)}\n${s.content ?? ""}\n`).join("\n");
}

export function toHtml(b: ExportBundle): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.name)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#0f172a}h1{border-bottom:2px solid #6366f1;padding-bottom:.3rem}h2{margin-top:2rem;color:#4f46e5}pre{white-space:pre-wrap;font-family:inherit}</style>
</head><body><h1>${esc(b.name)}</h1>${b.sections.map((s) => `<h2>${esc(s.title)}</h2><pre>${esc(s.content ?? "")}</pre>`).join("")}</body></html>`;
}

export function toJson(b: ExportBundle): string {
  return JSON.stringify(b, null, 2);
}

async function toDocxBlob(b: ExportBundle): Promise<Blob> {
  const children: Paragraph[] = [new Paragraph({ text: b.name, heading: HeadingLevel.TITLE })];
  for (const s of b.sections) {
    children.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }));
    for (const line of (s.content ?? "").split(/\n/)) {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBlob(doc);
  return buf;
}

function toPdfBlob(b: ExportBundle): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const w = pdf.internal.pageSize.getWidth() - 80;
  const h = pdf.internal.pageSize.getHeight() - 80;
  let y = 60;
  pdf.setFontSize(20); pdf.text(b.name, 40, y); y += 30;
  pdf.setFontSize(11);
  for (const s of b.sections) {
    if (y > h) { pdf.addPage(); y = 60; }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text(s.title, 40, y); y += 20;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(s.content ?? "", w);
    for (const line of lines) {
      if (y > h) { pdf.addPage(); y = 60; }
      pdf.text(line, 40, y); y += 14;
    }
    y += 12;
  }
  return pdf.output("blob");
}

async function toZipBlob(b: ExportBundle): Promise<Blob> {
  const zip = new JSZip();
  zip.file("project.json", toJson(b));
  zip.file("README.md", toMarkdown(b));
  const dir = zip.folder("sections")!;
  for (const s of b.sections) dir.file(`${sanitize(s.title)}.md`, `# ${s.title}\n\n${s.content ?? ""}`);
  return zip.generateAsync({ type: "blob" });
}

export async function buildExport(b: ExportBundle, fmt: ExportFormat): Promise<{ blob: Blob; filename: string }> {
  const base = sanitize(b.name);
  switch (fmt) {
    case "txt":  return { blob: new Blob([toTxt(b)],  { type: "text/plain" }),        filename: `${base}.txt` };
    case "md":   return { blob: new Blob([toMarkdown(b)], { type: "text/markdown" }), filename: `${base}.md` };
    case "json": return { blob: new Blob([toJson(b)], { type: "application/json" }),  filename: `${base}.json` };
    case "html": return { blob: new Blob([toHtml(b)], { type: "text/html" }),         filename: `${base}.html` };
    case "pdf":  return { blob: toPdfBlob(b),                                          filename: `${base}.pdf` };
    case "docx": return { blob: await toDocxBlob(b),                                   filename: `${base}.docx` };
    case "zip":  return { blob: await toZipBlob(b),                                    filename: `${base}.zip` };
  }
}

export async function downloadExport(b: ExportBundle, fmt: ExportFormat): Promise<void> {
  const { blob, filename } = await buildExport(b, fmt);
  saveAs(blob, filename);
}

export function previewText(b: ExportBundle, fmt: ExportFormat): string {
  switch (fmt) {
    case "md":   return toMarkdown(b);
    case "txt":  return toTxt(b);
    case "json": return toJson(b);
    case "html": return toHtml(b);
    default:     return toMarkdown(b);
  }
}

// Convert a project row into an export bundle.
export function projectToBundle(p: Record<string, unknown>): ExportBundle {
  const g = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  return {
    name: (p.name as string) || "Untitled project",
    meta: { id: p.id, updated_at: p.updated_at, tags: p.tags },
    sections: [
      { title: "Story",       content: g("story") },
      { title: "Characters",  content: g("characters") },
      { title: "Storyboard",  content: g("storyboard") },
      { title: "Voice Script",content: g("voice") },
      { title: "Songs",       content: g("songs") },
      { title: "Image Prompts",content: g("images") },
      { title: "SEO",         content: g("seo") },
    ],
  };
}