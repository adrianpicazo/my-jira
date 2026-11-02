import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useDebounced } from '../hooks';
import type { User } from '../types';
import { Avatar } from './icons';

/** "@query" right before the caret, at the start or after whitespace. */
const TRIGGER = /(?:^|\s)@([^\s@[\]]{0,40})$/;

/**
 * Remembers who was mentioned as "@Display Name" while typing, so the text can be
 * turned into Jira wiki mentions ([~accountid:…]) when it's sent.
 */
export function useMentions() {
  const map = useRef(new Map<string, string>());
  return {
    add: (u: User) => map.current.set(u.displayName, u.accountId),
    toWiki: (text: string) =>
      [...map.current.entries()]
        .sort(([a], [b]) => b.length - a.length)
        .reduce((t, [name, id]) => t.split(`@${name}`).join(`[~accountid:${id}]`), text),
    reset: () => map.current.clear(),
  };
}

type Mentions = ReturnType<typeof useMentions>;

export function MentionTextarea({
  issueKey,
  mentions,
  value,
  onChange,
  onKeyDown,
  ...rest
}: {
  issueKey: string;
  mentions: Mentions;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const dq = useDebounced(query ?? '', 150);
  const { data } = useQuery({
    queryKey: ['mentionable', issueKey, dq],
    queryFn: () => api.mentionable(issueKey, dq),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const users = query !== null ? (data ?? []).slice(0, 8) : [];
  const open = users.length > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  useEffect(() => setActive(0), [dq]);

  const detect = (el: HTMLTextAreaElement) => {
    const m = el.selectionStart === el.selectionEnd ? TRIGGER.exec(el.value.slice(0, el.selectionStart)) : null;
    setQuery(m ? m[1]! : null);
  };

  const pick = (u: User) => {
    const el = ref.current!;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([^\s@[\]]{0,40})$/, `@${u.displayName} `);
    mentions.add(u);
    onChange(before + value.slice(caret));
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  return (
    <div className="mention-wrap">
      <textarea
        ref={ref}
        rows={1}
        {...rest}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target);
        }}
        onSelect={(e) => detect(e.currentTarget)}
        onBlur={(e) => {
          // Let a click on a suggestion land first.
          setTimeout(() => setQuery(null), 150);
          rest.onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : users.length - 1)) % users.length);
              return;
            }
            if ((e.key === 'Enter' && !e.metaKey && !e.ctrlKey) || e.key === 'Tab') {
              e.preventDefault();
              pick(users[active] ?? users[0]!);
              return;
            }
            if (e.key === 'Escape') {
              e.stopPropagation();
              setQuery(null);
              return;
            }
          }
          onKeyDown?.(e);
        }}
      />
      {open && (
        <div className="mention-menu">
          {users.map((u, idx) => (
            <button
              key={u.accountId}
              type="button"
              className={`menu-item${idx === active ? ' active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(idx)}
              onClick={() => pick(u)}
            >
              <Avatar user={u} size={18} />
              <span className="menu-label">{u.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
