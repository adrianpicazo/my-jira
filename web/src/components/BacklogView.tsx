import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '../api';
import { useApp, useIssueActions, useLocalStorage } from '../hooks';
import type { Issue, Sprint } from '../types';
import { fmtRange } from '../util';
import { applyFilters, emptyFilters, FilterBar, type Filters } from './FilterBar';
import { Icon, StatusIcon } from './icons';
import { BacklogMenu, rankMoves, type MenuState } from './CardMenu';
import { IssueRow } from './IssueRow';
import { ContextMenu } from './ContextMenu';
import { Menu } from './Menu';
import { SprintFilter } from './SprintFilter';
import { Progress } from './Progress';
import { StatusFilter, statusesOf } from './StatusFilter';
import { useSlashFocus } from './useSlashFocus';

type DropPos = 'before' | 'after';

interface DragInfo {
  issue: Issue;
  sectionId: string;
  queryKey: QueryKey;
}

/** No key means "the end of that section" (dropped on its header or empty space). */
interface DropAt {
  sectionId: string;
  key?: string;
  pos?: DropPos;
}

/** Rows picked with ⌘/Ctrl-click (toggle) or ⇧-click (range within a section). */
interface Selection {
  keys: Set<string>;
  /** Last row clicked, the start of a ⇧-click range: [section, key]. */
  anchor: [string, string] | null;
  set: (keys: Set<string>, anchor: [string, string] | null) => void;
  openMenu: (x: number, y: number) => void;
}

interface Dnd {
  drag: MutableRefObject<DragInfo | null>;
  dropAt: DropAt | null;
  setDropAt: (d: DropAt | null) => void;
  end: () => void;
}

const isSub = (i: Issue) => !!i.issuetype?.subtask;

function Section({
  sprint,
  open,
  onToggle,
  filters,
  dnd,
  sel,
  hiddenStatusIds,
}: {
  sprint: Sprint | null;
  open: boolean;
  onToggle: () => void;
  filters: Filters;
  dnd: Dnd;
  sel: Selection;
  hiddenStatusIds: string[];
}) {
  const { board, openIssue } = useApp();
  const qc = useQueryClient();
  const { rank, moveToSprint } = useIssueActions();
  const id = sprint?.id ?? 'backlog';
  const sectionId = String(id);
  const queryKey: QueryKey = sprint ? ['issues', 'sprint', board.id, sprint.id] : ['issues', 'backlog', board.id];
  // Done work only matters in the sprint that's running.
  const showDone = sprint?.state === 'active';
  const { data: count } = useQuery({
    queryKey: ['count', board.id, id],
    queryFn: () => (sprint ? api.sprintCount(board.id, sprint.id, !showDone) : api.backlogCount(board.id)),
  });
  const [peek, setPeek] = useState(false);
  const { data: issues, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => (sprint ? api.sprintIssues(board.id, sprint.id) : api.backlog(board.id)),
    // Also loaded while hovering the count of a folded section, for its per-status tooltip.
    enabled: open || peek,
  });
  const { data: columns = [] } = useQuery({ queryKey: ['columns', board.id], queryFn: () => api.columns(board.id), staleTime: Infinity });
  // Subtasks fold into their story's row.
  const subtasksOf = new Map<string, Issue[]>();
  for (const i of issues ?? []) if (isSub(i) && i.parent) subtasksOf.set(i.parent.key, [...(subtasksOf.get(i.parent.key) ?? []), i]);
  const matching = new Set(issues ? applyFilters(issues, filters).map((i) => i.key) : []);
  const listed = (issues ?? []).filter(
    (i) => !isSub(i) && (showDone || i.status?.category !== 'done') && !hiddenStatusIds.includes(i.status?.id ?? ''),
  );
  const visible = listed.filter((i) => matching.has(i.key) || subtasksOf.get(i.key)?.some((s) => matching.has(s.key)));
  const [menu, setMenu] = useState<MenuState | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  // Stories/tasks rank among the section's stories/tasks; subtasks only among their siblings.
  const openMenu = (e: React.MouseEvent, issue: Issue) => {
    e.preventDefault();
    if (sel.keys.size > 1 && sel.keys.has(issue.key)) return sel.openMenu(e.clientX, e.clientY);
    const peers = (issues ?? [])
      .filter((i) => (issue.issuetype?.subtask ? i.issuetype?.subtask && i.parent?.key === issue.parent?.key : !i.issuetype?.subtask))
      .map((i) => i.key);
    setMenu({ x: e.clientX, y: e.clientY, issue, moves: rankMoves(issue.key, peers) });
  };
  const rowClick = (e: React.MouseEvent, issue: Issue) => {
    // ⇧-click would otherwise select the text in between.
    if (e.shiftKey) window.getSelection()?.removeAllRanges();
    if (e.metaKey || e.ctrlKey) {
      const keys = new Set(sel.keys);
      if (keys.has(issue.key)) keys.delete(issue.key);
      else keys.add(issue.key);
      return sel.set(keys, [sectionId, issue.key]);
    }
    if (e.shiftKey && sel.anchor?.[0] === sectionId) {
      const a = visible.findIndex((i) => i.key === sel.anchor![1]);
      const b = visible.findIndex((i) => i.key === issue.key);
      if (a >= 0 && b >= 0) {
        const range = visible.slice(Math.min(a, b), Math.max(a, b) + 1).map((i) => i.key);
        return sel.set(new Set([...sel.keys, ...range]), sel.anchor);
      }
    }
    if (e.shiftKey) return sel.set(new Set([...sel.keys, issue.key]), [sectionId, issue.key]);
    sel.set(new Set(), null);
    openIssue(issue.key);
  };
  const filtering = filters.q || filters.assignees.length || hiddenStatusIds.length;

  /*
   * Drag & drop. Within a section: stories/tasks reorder among stories/tasks, subtasks only among
   * their siblings. Across sections: stories/tasks move to that sprint (at the row they're dropped
   * on, or at the end); subtasks always follow their story, so they can't change sprint.
   */
  const { drag, dropAt, setDropAt, end } = dnd;
  const rowDragOver = (e: React.DragEvent, row: Issue) => {
    const d = drag.current;
    if (!d) return;
    const allowed =
      d.sectionId === sectionId
        ? isSub(d.issue)
          ? isSub(row) && row.parent?.key === d.issue.parent?.key
          : !isSub(row)
        : !isSub(d.issue) && !isSub(row);
    if (!allowed) return;
    e.preventDefault();
    e.stopPropagation();
    if (row.key === d.issue.key) return setDropAt(null);
    const r = e.currentTarget.getBoundingClientRect();
    setDropAt({ sectionId, key: row.key, pos: e.clientY < r.top + r.height / 2 ? 'before' : 'after' });
  };
  const sectionDragOver = (e: React.DragEvent) => {
    const d = drag.current;
    if (!d || d.sectionId === sectionId || isSub(d.issue)) return;
    e.preventDefault();
    if (dropAt?.sectionId !== sectionId || dropAt.key) setDropAt({ sectionId });
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const d = drag.current;
    const at = dropAt;
    end();
    if (!d || !at || at.sectionId !== sectionId) return;
    const target = at.key && at.pos ? { pos: at.pos, target: at.key } : undefined;
    if (d.sectionId === sectionId) {
      if (target) rank(d.issue.key, target.pos, target.target);
      return;
    }
    // Optimistically take it out of its section and drop it where it landed here.
    const local = () => {
      qc.setQueryData<Issue[]>(d.queryKey, (old) => old?.filter((i) => i.key !== d.issue.key && i.parent?.key !== d.issue.key));
      qc.setQueryData<Issue[]>(queryKey, (old) => {
        if (!old) return old;
        const idx = target ? old.findIndex((i) => i.key === target.target) + (target.pos === 'after' ? 1 : 0) : old.length;
        return [...old.slice(0, idx), d.issue, ...old.slice(idx)];
      });
    };
    moveToSprint(d.issue.key, sprint, { at: target, local });
  };
  const isTarget = dropAt?.sectionId === sectionId && !dropAt.key;

  return (
    <section
      className={`sprint-section${isTarget ? ' drop-target' : ''}`}
      onDragOver={sectionDragOver}
      onDragLeave={(e) => isTarget && !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
      onDrop={onDrop}
    >
      <div className="sprint-header" onClick={onToggle}>
        <Icon.Chevron open={open} />
        {sprint ? <Icon.Sprint size={14} /> : <Icon.Backlog size={14} />}
        <span className="sprint-name">{sprint?.name ?? 'Backlog'}</span>
        {sprint?.state === 'active' && <span className="badge badge-active">Activo</span>}
        {sprint && <span className="muted">{fmtRange(sprint.startDate, sprint.endDate)}</span>}
        <span className="muted count-stats" onMouseEnter={() => setPeek(true)}>
          {count ? `${filtering && issues ? `${visible.length} de ` : ''}${count.total} issues` : ''}
          {count && count.total > 0 && (
            <span className="tooltip">
              {issues ? (
                <>
                  <span className="tooltip-row tooltip-total">
                    <span>Total</span>
                    <span>{listed.length}</span>
                  </span>
                  {statusesOf(listed, columns).map((st) => (
                    <span key={st.id} className="tooltip-row">
                      <span className="tooltip-status">
                        <StatusIcon status={st} size={12} /> {st.name}
                      </span>
                      <span>{listed.filter((x) => x.status?.id === st.id).length}</span>
                    </span>
                  ))}
                </>
              ) : (
                <span className="tooltip-row">Cargando…</span>
              )}
            </span>
          )}
        </span>
        <span className="spacer" />
        {listed.length > 0 && <Progress issues={listed} />}
      </div>
      {open && (
        <div className="sprint-body">
          {sprint?.goal && <div className="sprint-goal">{sprint.goal}</div>}
          {isLoading && <div className="empty">Cargando…</div>}
          {error && <div className="empty error">{(error as Error).message}</div>}
          {issues && !visible.length && <div className="empty">{listed.length ? 'Nada coincide con el filtro.' : 'Vacío.'}</div>}
          {visible.map((i) => (
            <IssueRow
              key={i.key}
              issue={i}
              preview
              selected={sel.keys.has(i.key)}
              onClick={(e) => rowClick(e, i)}
              subtasks={{ issues: subtasksOf.get(i.key) ?? [], columns }}
              onContextMenu={(e) => openMenu(e, i)}
              drag={{
                onDragStart: () => {
                  drag.current = { issue: i, sectionId, queryKey };
                },
                onDragEnd: end,
                onDragOver: (e) => rowDragOver(e, i),
                dropPos: dropAt?.sectionId === sectionId && dropAt.key === i.key ? dropAt.pos ?? null : null,
              }}
            />
          ))}
          {menu && <BacklogMenu state={menu} sprintId={sprint?.id ?? null} onClose={closeMenu} />}
        </div>
      )}
    </section>
  );
}

export function BacklogView() {
  const { board, sprints, hiddenSprintIds } = useApp();
  const { moveManyToSprint } = useIssueActions();
  const [selected, setSelected] = useState<{ keys: Set<string>; anchor: [string, string] | null }>({ keys: new Set(), anchor: null });
  const [multiMenu, setMultiMenu] = useState<{ x: number; y: number } | null>(null);
  const sel: Selection = {
    ...selected,
    set: (keys, anchor) => setSelected({ keys, anchor }),
    openMenu: (x, y) => setMultiMenu({ x, y }),
  };
  const clearSelection = useCallback(() => setSelected({ keys: new Set(), anchor: null }), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && clearSelection();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);
  const visible = sprints.filter((s) => !hiddenSprintIds.includes(s.id));
  const [expanded, setExpanded] = useLocalStorage<(number | 'backlog')[]>(`expanded:${board.id}`, []);
  const [filters, setFilters] = useLocalStorage<Filters>(`filters:backlog:${board.id}`, emptyFilters);
  const [hiddenStatusIds, setHiddenStatusIds] = useLocalStorage<string[]>(`hiddenStatuses:backlog:${board.id}`, []);
  const { data: columns } = useQuery({ queryKey: ['columns', board.id], queryFn: () => api.columns(board.id), staleTime: Infinity });
  // Every status on the board, in column order; sections load lazily, so issues can't tell them all.
  const statuses = (columns ?? []).flatMap((c) =>
    c.statusIds.map((id, i) => ({ id, name: c.statusNames?.[i] ?? id, category: c.statusCategories?.[i] ?? 'new' })),
  );
  const searchRef = useRef<HTMLInputElement>(null);
  useSlashFocus(searchRef);
  const drag = useRef<DragInfo | null>(null);
  const [dropAt, setDropAt] = useState<DropAt | null>(null);
  const end = useCallback(() => {
    drag.current = null;
    setDropAt(null);
  }, []);
  const dnd: Dnd = { drag, dropAt, setDropAt, end };

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
          {selected.keys.size > 0 && (
            <button className="btn btn-ghost" title="Esc para deseleccionar" onClick={clearSelection}>
              {selected.keys.size} seleccionadas ✕
            </button>
          )}
          <SprintFilter />
        </div>
      </header>
      <div className="toolbar">
        <FilterBar filters={filters} onChange={setFilters} searchRef={searchRef} />
        <StatusFilter statuses={statuses} hidden={hiddenStatusIds} onChange={setHiddenStatusIds} />
      </div>
      <div className="list">
        {visible.map((s) => (
          <Section key={s.id} sprint={s} open={expanded.includes(s.id)} onToggle={() => toggle(s.id)} filters={filters} dnd={dnd} sel={sel} hiddenStatusIds={hiddenStatusIds} />
        ))}
        <Section sprint={null} open={expanded.includes('backlog')} onToggle={() => toggle('backlog')} filters={filters} dnd={dnd} sel={sel} hiddenStatusIds={hiddenStatusIds} />
      </div>
      {multiMenu && (
        <ContextMenu
          x={multiMenu.x}
          y={multiMenu.y}
          onClose={() => setMultiMenu(null)}
          items={[
            {
              label: `Mover ${selected.keys.size} issues a otro sprint`,
              icon: <Icon.Sprint />,
              submenu: (close) => (
                <Menu
                  placeholder="Sprint…"
                  items={[
                    ...visible.map((s) => ({ id: `s:${s.id}`, label: s.name, icon: <Icon.Sprint size={13} />, hint: s.state === 'active' ? 'Activo' : undefined })),
                    { id: 'backlog', label: 'Backlog', icon: <Icon.Backlog size={13} /> },
                  ]}
                  onSelect={(item) => {
                    close();
                    setMultiMenu(null);
                    moveManyToSprint([...selected.keys], visible.find((s) => `s:${s.id}` === item.id) ?? null);
                    clearSelection();
                  }}
                />
              ),
            },
            { label: 'Deseleccionar', icon: <Icon.Close />, onSelect: clearSelection },
          ]}
        />
      )}
    </div>
  );
}
