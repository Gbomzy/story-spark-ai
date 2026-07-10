import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { qwenTranslate, SUPPORTED_LANGUAGES } from "@/lib/qwenTranslate.functions";
import { Copy, Loader2, Languages } from "lucide-react";

export const Route = createFileRoute("/_app/translate")({
  head: () => ({ meta: [{ title: "Translate — StorySpark AI" }] }),
  component: TranslatePage,
});

function TranslatePage() {
  const run = useServerFn(qwenTranslate);
  const [text, setText] = useState("");
  const [target, setTarget] = useState("Spanish");
  const [source, setSource] = useState("auto");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

  async function translate() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await run({ data: { text, targetLanguage: target, sourceLanguage: source } });
      setOut(r.translated);
      toast.success(`Translated with ${r.provider}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Translate"
        description="Translate stories, characters, storyboards, voice scripts, SEO and subtitles with Qwen Translation."
      />
      <Card className="glass rounded-3xl p-6 shadow-soft">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">From</span>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2">
              {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">To</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2">
              {SUPPORTED_LANGUAGES.filter((l) => l.code !== "auto").map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-72" placeholder="Paste text to translate…" />
          <div className="relative">
            <Textarea value={out} readOnly className="min-h-72 bg-muted/40" placeholder="Translation" />
            {out && (
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(out); toast.success("Copied"); }} className="absolute right-2 top-2">
                <Copy className="mr-1 h-4 w-4" /> Copy
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={translate} disabled={loading || !text.trim()}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Translating…</> : <><Languages className="mr-2 h-4 w-4" /> Translate</>}
          </Button>
        </div>
      </Card>
    </div>
  );
}