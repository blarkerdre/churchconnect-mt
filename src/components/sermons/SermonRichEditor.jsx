import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { TextAlign } from "@tiptap/extension-text-align";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, AlignLeft, AlignCenter, AlignRight, AlignJustify, PenLine } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import HandwritingPad from "@/components/sermons/HandwritingPad";

const MenuBar = ({ editor, onOpenPad }) => {
  if (!editor) return null;

  const buttons = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), label: "Bold" },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), label: "Italic" },
    { icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline"), label: "Underline" },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }), label: "Heading" },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList"), label: "Bullet List" },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList"), label: "Ordered List" },
  ];

  const alignButtons = [
    { icon: AlignLeft, action: () => editor.chain().focus().setTextAlign("left").run(), active: editor.isActive({ textAlign: "left" }), label: "Align Left" },
    { icon: AlignCenter, action: () => editor.chain().focus().setTextAlign("center").run(), active: editor.isActive({ textAlign: "center" }), label: "Align Center" },
    { icon: AlignRight, action: () => editor.chain().focus().setTextAlign("right").run(), active: editor.isActive({ textAlign: "right" }), label: "Align Right" },
    { icon: AlignJustify, action: () => editor.chain().focus().setTextAlign("justify").run(), active: editor.isActive({ textAlign: "justify" }), label: "Justify" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border p-1">
      {buttons.map((btn) => (
        <Toggle
          key={btn.label}
          size="sm"
          pressed={btn.active}
          onPressedChange={btn.action}
          aria-label={btn.label}
          className="h-8 w-8 p-0"
        >
          <btn.icon className="h-4 w-4" />
        </Toggle>
      ))}
      <div className="w-px h-6 bg-border mx-0.5" />
      {alignButtons.map((btn) => (
        <Toggle
          key={btn.label}
          size="sm"
          pressed={btn.active}
          onPressedChange={btn.action}
          aria-label={btn.label}
          className="h-8 w-8 p-0"
        >
          <btn.icon className="h-4 w-4" />
        </Toggle>
      ))}
      <div className="w-px h-6 bg-border mx-0.5" />
      <input
        type="color"
        value={editor.getAttributes("textStyle").color || "#000000"}
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        className="h-7 w-7 rounded border border-input cursor-pointer p-0"
        title="Text color"
      />
      <div className="w-px h-6 bg-border mx-0.5" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onOpenPad}
        className="h-8 px-2 gap-1"
        title="Write with pen (handwriting → text)"
      >
        <PenLine className="h-4 w-4" />
        <span className="text-xs hidden sm:inline">Pen</span>
      </Button>
    </div>
  );
};

export default function SermonRichEditor({ content, onChange }) {
  const [padOpen, setPadOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: "Write your sermon notes here..." }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const handleInsertText = (text) => {
    if (!editor || !text) return;
    // Convert newlines to hard breaks so multi-line handwriting stays multi-line
    const html = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${line.replace(/</g, "&lt;")}</p>`)
      .join("");
    editor.chain().focus().insertContent(html).run();
  };

  return (
    <div className="rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring">
      <MenuBar editor={editor} onOpenPad={() => setPadOpen(true)} />
      <div className="max-h-[400px] overflow-y-auto">
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none px-3 py-2 min-h-[200px] focus:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[200px] [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none"
        />
      </div>
      <HandwritingPad open={padOpen} onOpenChange={setPadOpen} onConvert={handleInsertText} />
    </div>
  );
}

