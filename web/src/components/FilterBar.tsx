import type { RefObject } from 'react';
import { useApp } from '../hooks';
import type { Issue, User } from '../types';
import { Avatar, Icon } from './icons';

export interface Filters {
  q: string;
  /** accountIds; '' means unassigned */
  assignees: string[];
}

export const emptyFilters: Filters = { q: '', assignees: [] };

export function applyFilters(issues: Issue[], f: Filters) {
  const needle = f.q.trim().toLowerCase();
  return issues.filter(
    (i) =>
      (!needle || i.summary.toLowerCase().includes(needle) || i.key.toLowerCase().includes(needle) || i.labels.some((l) => l.toLowerCase().includes(needle))) &&
      (!f.assignees.length || f.assignees.includes(i.assignee?.accountId ?? '')),
  );
}

export function assigneesOf(issues: Issue[]) {
  const map = new Map<string, User>();
  for (const i of issues) if (i.assignee) map.set(i.assignee.accountId, i.assignee);
  return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function FilterBar({
  filters,
  onChange,
  users = [],
  searchRef,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  users?: User[];
  searchRef?: RefObject<HTMLInputElement | null>;
}) {
  const { me } = useApp();
  const toggle = (id: string) =>
    onChange({
      ...filters,
      assignees: filters.assignees.includes(id) ? filters.assignees.filter((a) => a !== id) : [...filters.assignees, id],
    });
  const mine = filters.assignees.length === 1 && filters.assignees[0] === me.accountId;
  return (
    <div className="filterbar">
      <label className="search">
        <Icon.Search />
        <input
          ref={searchRef}
          value={filters.q}
          placeholder="Buscar…  /"
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && (onChange({ ...filters, q: '' }), e.currentTarget.blur())}
        />
      </label>
      <button className={`btn btn-ghost${mine ? ' on' : ''}`} onClick={() => onChange({ ...filters, assignees: mine ? [] : [me.accountId] })}>
        <Avatar user={me} size={16} /> Mías
      </button>
      {users.length > 0 && (
        <div className="facepile">
          {users.map((u) => (
            <button
              key={u.accountId}
              className={`face${filters.assignees.includes(u.accountId) ? ' on' : ''}`}
              title={u.displayName}
              onClick={() => toggle(u.accountId)}
            >
              <Avatar user={u} size={22} />
            </button>
          ))}
          <button className={`face${filters.assignees.includes('') ? ' on' : ''}`} title="Sin asignar" onClick={() => toggle('')}>
            <Avatar user={null} size={22} />
          </button>
        </div>
      )}
      {(filters.q || filters.assignees.length > 0) && (
        <button className="btn btn-ghost" onClick={() => onChange(emptyFilters)}>
          <Icon.Close size={12} /> Limpiar
        </button>
      )}
    </div>
  );
}
