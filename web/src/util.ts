import type { Column, IssueType, Status } from './types';

const dayFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });
const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export const fmtDay = (iso?: string) => (iso ? dayFmt.format(new Date(iso)) : '');
export const fmtFull = (iso: string) => fullFmt.format(new Date(iso));

export function fmtRange(start?: string, end?: string) {
  if (!start && !end) return '';
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

export function relTime(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', Infinity],
  ];
  let v = diff;
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit);
    v /= size;
  }
  return '';
}

export function daysLeft(end?: string) {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PALETTE = ['#e5484d', '#f76b15', '#ffc53d', '#46a758', '#12a594', '#0090ff', '#5e6ad2', '#8e4ec6', '#d6409f', '#978365'];
export const colorFor = (s: string) => PALETTE[hash(s) % PALETTE.length];

/** Jira-like colour per issue type, used for the bar on the left of each card. */
export function typeColor(t: IssueType | null | undefined) {
  if (!t) return 'var(--faint)';
  const n = t.name.toLowerCase();
  if (/bug|error|incidencia/.test(n)) return '#e5493a';
  if (/stor|historia/.test(n)) return '#63ba3c';
  if (/task|tarea/.test(n)) return '#4bade8';
  return '#f2a03d';
}

/**
 * Linear-style colour + "fill" for a Jira status. Derived only from its category and the
 * position of its column on the board, so it works for any workflow.
 */
export function statusStyle(s: Status | null | undefined, columns: Column[] = []): { color: string; fill: number; kind: 'todo' | 'progress' | 'done' } {
  if (!s || s.category === 'new') return { color: 'var(--muted)', fill: 0, kind: 'todo' };
  if (s.category === 'done') return { color: '#5e6ad2', fill: 1, kind: 'done' };
  const idx = columns.findIndex((c) => c.statusIds.includes(s.id));
  const t = idx < 0 || columns.length < 2 ? 0.5 : idx / (columns.length - 1);
  return {
    color: `color-mix(in srgb, #46a758 ${Math.round(t * 100)}%, #f2c94c)`,
    fill: 0.3 + 0.6 * t,
    kind: 'progress',
  };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
