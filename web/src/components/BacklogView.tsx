import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useApp, useLocalStorage } from '../hooks';
import type { Sprint } from '../types';
import { fmtRange } from '../util';
import { applyFilters, emptyFilters, FilterBar, type Filters } from './FilterBar';
import { Icon } from './icons';
import { IssueRow } from './IssueRow';
import { SprintFilter } from './SprintFilter';
import { Progress } from './Progress';
import { useSlashFocus } from './useSlashFocus';

function Section({ sprint, open, onToggle, filters }: { sprint: Sprint | null; open: boolean; onToggle: () => void; filters: Filters }) {
  const { board } = useApp();
  const id = sprint?.id ?? 'backlog';
  const { data: count } = useQuery({
    queryKey: ['count', board.id, id],
    queryFn: () => (sprint ? api.sprintCount(board.id, sprint.id) : api.backlogCount(board.id)),
  });
  const { data: issues, isLoading, error } = useQuery({
    queryKey: sprint ? ['issues', 'sprint', board.id, sprint.id] : ['issues', 'backlog', board.id],
    queryFn: () => (sprint ? api.sprintIssues(board.id, sprint.id) : api.backlog(board.id)),
    enabled: open,
  });
  const visible = issues ? applyFilters(issues, filters) : [];
  const filtering = filters.q || filters.assignees.length;

  return (
    <section className="sprint-section">
      <div className="sprint-header" onClick={onToggle}>
        <Icon.Chevron open={open} />
        {sprint ? <Icon.Sprint size={14} /> : <Icon.Backlog size={14} />}
        <span className="sprint-name">{sprint?.name ?? 'Backlog'}</span>
        {sprint?.state === 'active' && <span className="badge badge-active">Activo</span>}
        {sprint && <span className="muted">{fmtRange(sprint.startDate, sprint.endDate)}</span>}
        <span className="muted">
          {count ? `${filtering && issues ? `${visible.length} de ` : ''}${count.total} issues` : ''}
        </span>
        <span className="spacer" />
        {issues && issues.length > 0 && <Progress issues={issues} />}
      </div>
      {open && (
        <div className="sprint-body">
          {sprint?.goal && <div className="sprint-goal">{sprint.goal}</div>}
          {isLoading && <div className="empty">Cargando…</div>}
          {error && <div className="empty error">{(error as Error).message}</div>}
          {issues && !visible.length && <div className="empty">{issues.length ? 'Nada coincide con el filtro.' : 'Vacío.'}</div>}
          {visible.map((i) => (
            <IssueRow key={i.key} issue={i} />
          ))}
        </div>
      )}
    </section>
  );
}

export function BacklogView() {
  const { board, sprints, hiddenSprintIds } = useApp();
  const visible = sprints.filter((s) => !hiddenSprintIds.includes(s.id));
  const [expanded, setExpanded] = useLocalStorage<(number | 'backlog')[]>(`expanded:${board.id}`, []);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const searchRef = useRef<HTMLInputElement>(null);
  useSlashFocus(searchRef);

  const toggle = (id: number | 'backlog') =>
    setExpanded(expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id]);

  return (
    <div className="view">
      <header className="view-header">
        <div className="view-title">
          <h1>Backlog</h1>
          <span className="muted">{visible.length} sprints</span>
        </div>
        <div className="view-actions">
          <button className="btn btn-ghost" onClick={() => setExpanded(expanded.length ? [] : [...visible.map((s) => s.id), 'backlog'])}>
            {expanded.length ? 'Plegar todo' : 'Desplegar todo'}
          </button>
          <SprintFilter />
        </div>
      </header>
      <div className="toolbar">
        <FilterBar filters={filters} onChange={setFilters} searchRef={searchRef} />
      </div>
      <div className="list">
        {visible.map((s) => (
          <Section key={s.id} sprint={s} open={expanded.includes(s.id)} onToggle={() => toggle(s.id)} filters={filters} />
        ))}
        <Section sprint={null} open={expanded.includes('backlog')} onToggle={() => toggle('backlog')} filters={filters} />
      </div>
    </div>
  );
}
