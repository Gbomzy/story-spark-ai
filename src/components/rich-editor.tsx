"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bold, Italic, Underline as U, List, ListOrdered, Quote, Code, Link as LinkIcon, Table as TableIcon, Heading1, Heading2, Undo2, Redo2, Search } from "lucide-react";

export interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichEditor({ value, onChange, placeholder, minHeight = 220 }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none px-4 py-3 focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  const lastValue = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value !== lastValue.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      lastValue.current = value;
    }
  }, [value, editor]);

  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [showFind, setShowFind] = useState(false);

  if (!editor) return <div style={{ minHeight }} className="rounded-2xl bg-muted/40" />;

  const Btn = ({ on, active, children, label }: { on: () => void; active?: boolean; children: React.ReactNode; label: string }) => (
    <Button variant="ghost" size="sm" aria-label={label} onClick={on}
      className={`h-8 w-8 rounded-lg p-0 ${active ? "bg-primary/15 text-primary" : ""}`}>{children}</Button>
  );

  const applyReplace = (all: boolean) => {
    if (!find) return;
    const html = editor.getHTML();
    const next = all ? html.split(find).join(replace) : html.replace(find, replace);
    editor.commands.setContent(next);
    onChange(next);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5">
        <Btn label="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn label="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn label="Underline" on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}><U className="h-3.5 w-3.5" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn label="Heading 1" on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}><Heading1 className="h-3.5 w-3.5" /></Btn>
        <Btn label="Heading 2" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-3.5 w-3.5" /></Btn>
        <Btn label="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-3.5 w-3.5" /></Btn>
        <Btn label="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-3.5 w-3.5" /></Btn>
        <Btn label="Quote" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-3.5 w-3.5" /></Btn>
        <Btn label="Code" on={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}><Code className="h-3.5 w-3.5" /></Btn>
        <Btn label="Link" on={() => { const url = window.prompt("URL"); if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); }} active={editor.isActive("link")}><LinkIcon className="h-3.5 w-3.5" /></Btn>
        <Btn label="Insert table" on={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-3.5 w-3.5" /></Btn>
        <div className="mx-1 h-5 w-px bg-border" />
        <Btn label="Undo" on={() => editor.chain().focus().undo().run()}><Undo2 className="h-3.5 w-3.5" /></Btn>
        <Btn label="Redo" on={() => editor.chain().focus().redo().run()}><Redo2 className="h-3.5 w-3.5" /></Btn>
        <Btn label="Find & Replace" on={() => setShowFind((s) => !s)} active={showFind}><Search className="h-3.5 w-3.5" /></Btn>
      </div>
      {showFind && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 p-2">
          <Input placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} className="h-8 max-w-[160px] rounded-lg text-xs" />
          <Input placeholder="Replace" value={replace} onChange={(e) => setReplace(e.target.value)} className="h-8 max-w-[160px] rounded-lg text-xs" />
          <Button size="sm" variant="secondary" className="h-8 rounded-lg" onClick={() => applyReplace(false)}>Replace</Button>
          <Button size="sm" className="h-8 rounded-lg gradient-primary text-white" onClick={() => applyReplace(true)}>Replace all</Button>
        </div>
      )}
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}