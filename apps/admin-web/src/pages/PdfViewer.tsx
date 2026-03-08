import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

const TOKEN_REFRESH_MS = 90 * 60 * 1000;
const CSS_SCALE = 1.5;
const MAX_PAGE_WIDTH = 850;

export default function PdfViewer() {
  const { materialId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const title = searchParams.get('title') || 'PDF Document';
  const backTo = searchParams.get('back') || '/courses';

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPdf = useCallback(async () => {
    if (!materialId) return;
    try {
      const data = await api<{ url: string }>(`/stream/materials/${materialId}/pdf-token`);
      const base = import.meta.env.VITE_API_URL ?? '';
      const streamUrl = `${base}${data.url}`;

      const res = await fetch(streamUrl);
      if (!res.ok) throw new Error('Failed to load PDF');
      const buffer = await res.arrayBuffer();

      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
      setPdfDoc(doc);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    fetchPdf();
    refreshTimer.current = setInterval(fetchPdf, TOKEN_REFRESH_MS);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [fetchPdf]);

  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';

    let cancelled = false;

    const dpr = window.devicePixelRatio || 1;

    (async () => {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled) break;
        const page = await pdfDoc.getPage(i);

        const cssViewport = page.getViewport({ scale: CSS_SCALE });
        const cssWidth = Math.min(cssViewport.width, MAX_PAGE_WIDTH);
        const scaleFactor = cssWidth / cssViewport.width;
        const cssHeight = cssViewport.height * scaleFactor;

        const renderScale = CSS_SCALE * scaleFactor * dpr;
        const renderViewport = page.getViewport({ scale: renderScale });

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `margin: 0 auto 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); background: #fff; line-height: 0; width: ${cssWidth}px;`;

        const canvas = document.createElement('canvas');
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        canvas.style.cssText = `width: ${cssWidth}px; height: ${cssHeight}px; display: block;`;

        wrapper.appendChild(canvas);
        container.appendChild(wrapper);

        await page.render({ canvas, viewport: renderViewport }).promise;
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
        e.preventDefault();
      }
    };
    const handleContextMenu = (e: Event) => e.preventDefault();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.9rem', display: 'inline-block', marginBottom: '1rem' }}>
          {error}
        </div>
        <div>
          <button onClick={() => navigate(backTo)} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', userSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <button
          onClick={() => navigate(backTo)}
          style={{ padding: '0.35rem 0.75rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          ← Back
        </button>
        <span style={{ fontWeight: 500, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'auto', padding: '1rem', background: 'var(--color-bg)' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Loading PDF...</div>
        )}
      </div>
    </div>
  );
}
