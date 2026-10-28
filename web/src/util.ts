import type { Status } from './types';

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

/** Linear-style colour + "fill" for a Jira status, guessed from its category and name. */
export function statusStyle(s: Status | null | undefined): { color: string; fill: number; kind: 'todo' | 'progress' | 'done' | 'cancel' } {
  if (!s) return { color: 'var(--muted)', fill: 0, kind: 'todo' };
  const n = s.name.toLowerCase();
  if (s.category === 'done') {
    if (/cancel|won.?t|descart|rechaz|duplica/.test(n)) return { color: 'var(--muted)', fill: 1, kind: 'cancel' };
    return { color: '#5e6ad2', fill: 1, kind: 'done' };
  }
  if (s.category === 'new') return { color: 'var(--muted)', fill: 0, kind: 'todo' };
  if (/block|bloq/.test(n)) return { color: '#e5484d', fill: 0.5, kind: 'progress' };
  if (/deploy|release|merge/.test(n)) return { color: '#12a594', fill: 0.9, kind: 'progress' };
  if (/qa|test|review|revis/.test(n)) return { color: '#46a758', fill: 0.75, kind: 'progress' };
  return { color: '#f2c94c', fill: 0.5, kind: 'progress' };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
