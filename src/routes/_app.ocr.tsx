import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { qwenOcr } from "@/lib/qwenOcr.functions";
import { Copy, Download, Loader2, Upload } from "lucide-react";

export const Route = createFileRoute("/_app/ocr")({
  head: () => ({ meta: [{ title: "OCR — StorySpark AI" }] }),
  component: OcrPage,
});

function OcrPage() {
  const run = useServerFn(qwenOcr);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preserveLayout, setPreserveLayout] = useState(true);

  async function onFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(f);
  }

  async function runOcr() {
    if (!file || !preview) return;
    setLoading(true);
    try {
      const b64 = preview.split(",")[1] ?? "";
      const r = await run({ data: { imageBase64: b64, mimeType: file.type || "image/png", preserveLayout } });
      setText(r.text);
      toast.success(`Extracted ${r.text.length} characters via Qwen-VL OCR`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OCR failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="OCR"
        description="Extract text from images, storyboards, comic pages and documents using Qwen-VL OCR."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass rounded-3xl p-6 shadow-soft">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/60 p-10 text-center transition hover:border-primary">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Upload image (PNG, JPG, WebP)</span>
            <span className="text-xs text-muted-foreground">Max ~10 MB. For PDFs, convert to image or upload a page image.</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          {preview && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              <img src={preview} alt="OCR source" className="max-h-96 w-full object-contain" />
            </div>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={preserveLayout} onChange={(e) => setPreserveLayout(e.target.checked)} />
              Preserve layout
            </label>
            <Button onClick={runOcr} disabled={!file || loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extracting…</> : "Extract text"}
            </Button>
          </div>
        </Card>
        <Card className="glass rounded-3xl p-6 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Extracted text</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={!text} onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}>
                <Copy className="mr-1 h-4 w-4" /> Copy
              </Button>
              <Button size="sm" variant="ghost" disabled={!text} onClick={() => {
                const blob = new Blob([text], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "ocr.txt"; a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="mr-1 h-4 w-4" /> Download
              </Button>
            </div>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-96 font-mono text-sm" placeholder="Extracted text will appear here." />
        </Card>
      </div>
    </div>
  );
}