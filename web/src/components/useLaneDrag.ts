import { useRef, useState } from 'react';

type DropPos = 'before' | 'after';

/**
 * Applies the user's saved swimlane order. Lanes it doesn't know (a new epic, assignee…) keep
 * their natural place: right after the lane that precedes them in the default order.
 */
export function applyLaneOrder<T extends { id: string }>(groups: T[], order: string[]): T[] {
  if (!order.length) return groups;
  const out = order.map((id) => groups.find((g) => g.id === id)).filter((g): g is T => !!g);
  groups.forEach((g, i) => {
    if (out.includes(g)) return;
    const prev = groups[i - 1];
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, g);
  });
  return out;
}

/** Drag & drop of swimlane headers; independent from card drag & drop. */
export function useLaneDrag(ids: string[], onOrder: (ids: string[]) => void) {
  const dragging = useRef<string | null>(null);
  const [dropAt, setDropAt] = useState<{ id: string; pos: DropPos } | null>(null);
  const posOf = (e: React.DragEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? 'before' : 'after';
  };
  const end = () => {
    dragging.current = null;
    setDropAt(null);
  };
  return (id: string) => ({
    draggable: true,
    className: dropAt?.id === id ? ` lane-drop-${dropAt.pos}` : '',
    onDragStart: (e: React.DragEvent) => {
      dragging.current = id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    onDragEnd: end,
    onDragOver: (e: React.DragEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const pos = posOf(e);
      if (dropAt?.id !== id || dropAt.pos !== pos) setDropAt(dragging.current === id ? null : { id, pos });
    },
    onDragLeave: (e: React.DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragging.current;
      const pos = posOf(e);
      end();
      if (!from || from === id) return;
      const next = ids.filter((x) => x !== from);
      next.splice(next.indexOf(id) + (pos === 'after' ? 1 : 0), 0, from);
      onOrder(next);
    },
  });
}

export type LaneDrag = ReturnType<typeof useLaneDrag>;
