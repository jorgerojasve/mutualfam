import React, { useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { mediaApi } from '@civiccore/sdk';
import { Bold, Italic, List, Image as ImageIcon, Paperclip, Camera } from 'lucide-react';

const InteractiveEditor = ({ value, onChange }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Explica detalladamente tu propuesta o sube contenido multimedia desde tu celular...',
      }),
      Image,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert("❌ Error: Telegram no permite subir archivos mayores a 50MB mediante bots.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("⚠️ Advertencia: El archivo supera los 20MB. Esto consumirá muchos datos de quienes intenten verlo y podría tardar en subir.");
    }

    try {
      setIsUploading(true);
      const res = await mediaApi.uploadFile(file);
      
      if (res && res.file_id) {
        const mediaUrl = mediaApi.getMediaUrl(res.file_id);
        
        if (file.type.startsWith('image/')) {
          editor.chain().focus().setImage({ src: mediaUrl }).run();
        } else {
          editor.chain().focus().insertContent(`
            <div style="padding: 1rem; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; margin: 10px 0;">
              <strong>📎 Archivo Multimedia Adjunto:</strong> ${file.name} 
              <br>
              <video src="${mediaUrl}" controls style="max-width: 100%; margin-top: 10px; border-radius: 4px;"></video>
            </div>
            <p></p>
          `).run();
        }
      }
    } catch (err) {
      console.error("Error al subir multimedia:", err);
      alert("Hubo un error subiendo tu archivo. Asegúrate de que el bot de Telegram esté configurado en el servidor.");
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="form-input" style={{ padding: 0, overflow: 'hidden', minHeight: '250px', display: 'flex', flexDirection: 'column' }}>
      
      {/* TOOLBAR */}
      <div className="flex gap-2 p-2 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="p-1.5 rounded transition-colors"
          style={{ 
            color: editor.isActive('bold') ? '#3b82f6' : 'var(--text-secondary)',
            background: editor.isActive('bold') ? 'rgba(59, 130, 246, 0.2)' : 'transparent'
          }}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="p-1.5 rounded transition-colors"
          style={{ 
            color: editor.isActive('italic') ? '#3b82f6' : 'var(--text-secondary)',
            background: editor.isActive('italic') ? 'rgba(59, 130, 246, 0.2)' : 'transparent'
          }}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="p-1.5 rounded transition-colors"
          style={{ 
            color: editor.isActive('bulletList') ? '#3b82f6' : 'var(--text-secondary)',
            background: editor.isActive('bulletList') ? 'rgba(59, 130, 246, 0.2)' : 'transparent'
          }}
        >
          <List size={16} />
        </button>

        <div style={{ width: '1px', background: 'var(--border-strong)', margin: '0 0.5rem' }}></div>

        <button
          type="button"
          onClick={() => fileInputRef.current.click()}
          className="btn flex-1 flex justify-center items-center gap-2"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text)', padding: '0.75rem', borderRadius: '8px' }}
          disabled={isUploading}
        >
          {isUploading ? (
            <span className="loader" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span>
          ) : (
            <Camera size={20} />
          )}
          {isUploading ? 'Subiendo archivo...' : 'Tomar foto / Adjuntar'}
        </button>
        
        {/* Input oculto: capture="environment" forzará la cámara en móviles por defecto si el OS lo soporta */}
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,video/*,audio/*"
          capture="environment" 
          onChange={handleFileChange}
        />
      </div>

      {/* EDITOR CONTENT */}
      <div style={{ padding: '1rem', flex: 1, color: 'var(--text-primary)' }}>
        <style>{`
          .ProseMirror { outline: none; min-height: 150px; }
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--text-muted);
            pointer-events: none;
            height: 0;
          }
          .ProseMirror img {
            max-width: 100%;
            border-radius: var(--radius-md);
            margin: 1rem 0;
            box-shadow: var(--shadow-md);
          }
          .ProseMirror ul {
            padding-left: 1.5rem;
            list-style-type: disc;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default InteractiveEditor;
