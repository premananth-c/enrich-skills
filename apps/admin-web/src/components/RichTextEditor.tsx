import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-text-style/color';
import { FontFamily } from '@tiptap/extension-text-style/font-family';
import { FontSize } from '@tiptap/extension-text-style/font-size';
import { useCallback, useEffect, useState } from 'react';
import { emitToast } from '../lib/toast';

const FONT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
];

const FONT_SIZES = [
  { label: 'Default', value: '' },
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '28px', value: '28px' },
  { label: '32px', value: '32px' },
];

const COLOR_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Black', value: '#1a1a1a' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Purple', value: '#9333ea' },
];

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  editable?: boolean;
}

const editorContentStyle = (minH: string) =>
  `min-height: ${minH}; outline: none; padding: 8px 12px;`;

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your content here… You can add **bold**, *italic*, links, images, and tables.',
  minHeight = '200px',
  editable = true,
}: RichTextEditorProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value || '',
    editable,
    editorProps: {
      attributes: {
        class: 'rich-text-editor-content',
        style: editorContentStyle(minHeight),
      },
      handleDOMEvents: {
        paste(view, event) {
          const items = event.clipboardData?.items;
          if (!items) return false;
          for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const src = e.target?.result as string;
                  editor?.chain().focus().setImage({ src }).run();
                };
                reader.readAsDataURL(file);
              }
              return true;
            }
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (!editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  const addImage = useCallback(() => {
    if (!imageUrl.trim() || !editor) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl('');
    setShowImageInput(false);
  }, [editor, imageUrl]);

  const uploadImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      if (!file.type.startsWith('image/')) {
        emitToast('error', 'Please select an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        if (src) editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
      setShowImageInput(false);
    },
    [editor]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  if (!editor) return null;

  return (
    <div className="rich-text-editor" style={{ minHeight }}>
      {editable && (
        <div className="rich-text-editor-toolbar">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            1. List
          </button>
          <span className="sep" />
          <select
            title="Font"
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setFontFamily(v).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
            className="rich-text-editor-select"
          >
            {FONT_OPTIONS.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            title="Font size"
            value={editor.getAttributes('textStyle').fontSize || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setFontSize(v).run();
              else editor.chain().focus().unsetFontSize().run();
            }}
            className="rich-text-editor-select"
          >
            {FONT_SIZES.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            title="Text color"
            value={editor.getAttributes('textStyle').color || ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setColor(v).run();
              else editor.chain().focus().unsetColor().run();
            }}
            className="rich-text-editor-select"
          >
            {COLOR_OPTIONS.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="sep" />
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              onClick={() => setShowLinkInput((v) => !v)}
              title="Link"
            >
              🔗
            </button>
            {showLinkInput && (
              <div className="rich-text-editor-popover">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
                <button type="button" onClick={setLink}>OK</button>
                <button
                  type="button"
                  onClick={() => { setShowLinkInput(false); setLinkUrl(''); }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              onClick={() => setShowImageInput((v) => !v)}
              title="Image"
            >
              🖼
            </button>
            {showImageInput && (
              <div className="rich-text-editor-popover rich-text-editor-popover-image">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Image URL"
                  />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" onClick={addImage}>Insert URL</button>
                    <label style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                      Upload image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={uploadImage}
                        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
                      />
                    </label>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Or paste an image from clipboard (Ctrl+V).</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowImageInput(false); setImageUrl(''); }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            title="Insert table"
          >
            Table
          </button>
          {editor.isActive('table') && (
            <>
              <span className="sep" />
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Add column"
              >
                +Col
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="Add row"
              >
                +Row
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="Delete table"
              >
                Delete table
              </button>
            </>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: ed }) => ed.isActive('image') || ed.isActive('table')}
        className="rich-text-editor-bubble"
      >
        {editor.isActive('image') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteSelection().run()}
            title="Remove image"
          >
            Delete image
          </button>
        )}
        {editor.isActive('table') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Remove table"
          >
            Delete table
          </button>
        )}
      </BubbleMenu>
    </div>
  );
}
