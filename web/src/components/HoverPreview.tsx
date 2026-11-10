import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { Avatar } from './icons';

const DELAY_MS = 1500;
const WIDTH = 460;

/**
 * Shows an issue's description and reporter after hovering a row for a while.
 * Spread `handlers` on the row; render `preview` anywhere (it portals to the body).
 */
export function useHoverPreview(issueKey: string, enabled: boolean) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const hide = () => {
    window.clearTimeout(timer.current);
    setAnchor(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // The anchor rect goes stale on scroll.
  useEffect(() => {
    if (!anchor) return;
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [anchor]);

  const handlers = enabled
    ? {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
          const el = e.currentTarget;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setAnchor(el.getBoundingClientRect()), DELAY_MS);
        },
        onMouseLeave: hide,
        onMouseDown: hide,
        onDragStart: hide,
        onContextMenu: hide,
      }
    : {};
  return { handlers, preview: anchor && <Preview issueKey={issueKey} anchor={anchor} /> };
}

/** Long descriptions fade out at the bottom; short ones are left alone. */
function Body({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [html]);
  return (
    <div ref={ref} className={`prose hover-preview-body${overflows ? ' clipped' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function Preview({ issueKey, anchor }: { issueKey: string; anchor: DOMRect }) {
  // Same cache entry as the issue panel, so opening it afterwards is instant.
  const { data, isLoading, error } = useQuery({ queryKey: ['issue', issueKey], queryFn: () => api.issue(issueKey), staleTime: 60_000 });
  const below = anchor.bottom + 320 < window.innerHeight;
  const left = Math.max(16, Math.min(anchor.left + 120, window.innerWidth - WIDTH - 16));
  const style = below ? { top: anchor.bottom + 4, left } : { bottom: window.innerHeight - anchor.top + 4, left };
  return createPortal(
    <div className="hover-preview" style={{ ...style, width: WIDTH }}>
      <div className="hover-preview-meta">
        <span className="muted">Informador</span>
        <Avatar user={data?.reporter ?? null} size={16} />
        <span>{data ? (data.reporter?.displayName ?? '—') : '…'}</span>
      </div>
      {isLoading && <div className="muted small">Cargando…</div>}
      {error && <div className="error small">{(error as Error).message}</div>}
      {data &&
        (data.descriptionHtml ? (
          <Body html={data.descriptionHtml} />
        ) : (
          <div className="muted small">Sin descripción</div>
        ))}
    </div>,
    document.body,
  );
}
