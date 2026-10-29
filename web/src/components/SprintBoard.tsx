import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useApp, useIssueActions } from '../hooks';
import { toast } from '../toast';
import type { Column, Issue, ParentRef } from '../types';
import { colorFor, typeColor } from '../util';
import { Icon, PriorityIcon, StatusIcon } from './icons';
import { AssigneePicker, LabelChips } from './Pickers';
import { Progress } from './Progress';
import type { Group } from './SprintView';
import { statusesOf } from './StatusFilter';

/** Board columns from the Jira board config, or one per status seen when that isn't loaded yet. */
function useColumns(columns: Column[] | undefined, issues: Issue[]): Column[] {
  return useMemo(() => {
    const mapped = columns?.filter((c) => c.statusIds.length);
    if (mapped?.length) return mapped;
    const seen = new Map<string, Column>();
    for (const i of issues) if (i.status && !seen.has(i.status.id)) seen.set(i.status.id, { name: i.status.name, statusIds: [i.status.id] });
    return [...seen.values()];
  }, [columns, issues]);
}

type DropPos = 'before' | 'after';

/** What is being dragged. A "unit" is a story card or placeholder together with its subtasks. */
interface DragState {
  key: string;
  kind: 'card' | 'placeholder' | 'subtask';
  /** Issue whose rank changes: the card itself, or the story behind a placeholder. */
  rankKey: string;
  parentKey?: string;
  cellId: string;
  colIdx: number;
}

interface DropAt {
  /** Unit id or subtask key the indicator is drawn on. */
  id: string;
  pos: DropPos;
  target: string;
  cellId: string;
}

/**
 * A cell is a list of units in rank order: each story/task card followed by its own subtasks,
 * and, for subtasks whose story sits in another column (or outside the sprint), a placeholder
 * for that story heading them, so they never look like children of an unrelated card.
 */
interface Unit {
  id: string;
  head: { kind: 'card'; issue: Issue } | { kind: 'placeholder'; parent: ParentRef };
  subs: Issue[];
}

function arrange(list: Issue[], rankOf: (key: string) => number): Unit[] {
  const inCell = new Set(list.map((i) => i.key));
  const subs = new Map<string, Issue[]>();
  for (const i of list) {
    if (i.issuetype?.subtask && i.parent) subs.set(i.parent.key, [...(subs.get(i.parent.key) ?? []), i]);
  }
  const units: (Unit & { rank: number })[] = [];
  for (const i of list) {
    if (i.issuetype?.subtask && i.parent) continue;
    units.push({ id: i.key, head: { kind: 'card', issue: i }, subs: subs.get(i.key) ?? [], rank: rankOf(i.key) });
  }
  for (const [parentKey, children] of subs) {
    if (inCell.has(parentKey)) continue;
    units.push({ id: `p:${parentKey}`, head: { kind: 'placeholder', parent: children[0]!.parent! }, subs: children, rank: rankOf(parentKey) });
  }
  return units.sort((a, b) => (a.rank === b.rank ? 0 : a.rank - b.rank));
}

function dropPos(e: React.DragEvent): DropPos {
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? 'before' : 'after';
}

function FoldToggle({ count, folded, onToggle, children }: { count: number; folded: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <button
      className="card-subtasks"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <Icon.Chevron open={!folded} size={10} />
      {count} subtareas
      {children}
    </button>
  );
}

function SubtaskStats({ subtasks, columns }: { subtasks: Issue[]; columns: Column[] }) {
  return (
    <span className="muted subtask-stats">
      · {subtasks.filter((s) => s.status?.category === 'done').length} hechas
      <span className="tooltip">
        <span className="tooltip-row tooltip-total">
          <span>Total</span>
          <span>{subtasks.length}</span>
        </span>
        {statusesOf(subtasks, columns).map((s) => (
          <span key={s.id} className="tooltip-row">
            <span className="tooltip-status">
              <StatusIcon status={s} size={12} /> {s.name}
            </span>
            <span>{subtasks.filter((x) => x.status?.id === s.id).length}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

interface DragProps {
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  dropPos?: DropPos | null;
}

function ParentPlaceholder({
  parent,
  subtaskCount,
  allSubtasks,
  columns,
  folded,
  onToggle,
  onHover,
  draggable,
  drag,
}: {
  parent: ParentRef;
  subtaskCount: number;
  allSubtasks: Issue[];
  columns: Column[];
  folded: boolean;
  onToggle: () => void;
  onHover: (key: string | null) => void;
  draggable: boolean;
  drag: DragProps;
}) {
  const { openIssue } = useApp();
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`cell-parent${dragging ? ' dragging' : ''}`}
      style={{ '--type': typeColor(parent.issuetype) } as CSSProperties}
      title={`${parent.key} · ${parent.summary}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', parent.key);
        setDragging(true);
        drag.onDragStart();
      }}
      onDragEnd={() => {
        setDragging(false);
        drag.onDragEnd();
      }}
      onMouseEnter={() => onHover(parent.key)}
      onMouseLeave={() => onHover(null)}
      onClick={() => openIssue(parent.key)}
    >
      <div className="cell-parent-title">
        <span className="row-key">{parent.key}</span>
        <span className="ellipsis">{parent.summary}</span>
      </div>
      <FoldToggle count={subtaskCount} folded={folded} onToggle={onToggle}>
        <SubtaskStats subtasks={allSubtasks} columns={columns} />
      </FoldToggle>
    </div>
  );
}

interface CardProps extends DragProps {
  issue: Issue;
  showParent: boolean;
  subtaskCount: number;
  /** Every subtask of this story in the sprint, ignoring filters, for the breakdown tooltip. */
  allSubtasks: Issue[];
  columns: Column[];
  folded: boolean;
  onToggleSubtasks: () => void;
  /** 'flash' after unfolding its story, 'hover' while its placeholder is hovered */
  highlight: 'flash' | 'hover' | null;
}

function Card({ issue, showParent, subtaskCount, allSubtasks, columns, folded, onToggleSubtasks, highlight, onDragStart, onDragEnd, onDragOver, dropPos }: CardProps) {
  const { openIssue } = useApp();
  const [dragging, setDragging] = useState(false);
  const subtask = !!issue.issuetype?.subtask;
  return (
    <div
      className={`card${subtask ? ' card-sub' : ''}${dragging ? ' dragging' : ''}${highlight ? ` card-${highlight}` : ''}${dropPos ? ` drop-${dropPos}` : ''}`}
      style={{ '--type': typeColor(issue.issuetype) } as CSSProperties}
      title={issue.issuetype?.name}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', issue.key);
        setDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
      onDragOver={onDragOver}
      onClick={() => openIssue(issue.key)}
    >
      <div className="card-title">{issue.summary}</div>
      {(issue.labels.length > 0 || (showParent && issue.parent && !subtask)) && (
        <div className="card-chips">
          {showParent && issue.parent && !subtask && (
            <span className="chip chip-parent" title={issue.parent.summary}>
              <Icon.Epic color={colorFor(issue.parent.key)} size={10} />
              <span className="ellipsis">{issue.parent.summary}</span>
            </span>
          )}
          <LabelChips labels={issue.labels.slice(0, 2)} />
          {issue.labels.length > 2 && <span className="chip">+{issue.labels.length - 2}</span>}
        </div>
      )}
      <div className="card-foot">
        <span title={issue.status?.name} className="card-status">
          <StatusIcon status={issue.status} size={12} />
        </span>
        <PriorityIcon name={issue.priority?.name} size={12} />
        <span className="row-key">{issue.key}</span>
        <span className="spacer" />
        <AssigneePicker issueKey={issue.key} assignee={issue.assignee} />
      </div>
      {subtaskCount > 0 && (
        <FoldToggle count={subtaskCount} folded={folded} onToggle={onToggleSubtasks}>
          <SubtaskStats subtasks={allSubtasks} columns={columns} />
        </FoldToggle>
      )}
    </div>
  );
}

export function SprintBoard({
  groups,
  columns: rawColumns,
  issues,
  allIssues,
  collapsed,
  onToggle,
  showParent,
  hiddenStatusIds,
  collapsedStories,
  onToggleStory,
}: {
  groups: Group[];
  columns: Column[] | undefined;
  issues: Issue[];
  allIssues: Issue[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  showParent: boolean;
  hiddenStatusIds: string[];
  collapsedStories: string[];
  onToggleStory: (key: string) => void;
}) {
  const qc = useQueryClient();
  const { transition, rank } = useIssueActions();
  const allColumns = useColumns(rawColumns, issues);
  // A column disappears only when every status mapped to it is hidden.
  const columns = useMemo(
    () => allColumns.filter((c) => c.statusIds.some((s) => !hiddenStatusIds.includes(s))),
    [allColumns, hiddenStatusIds],
  );
  const colOf = useMemo(() => {
    const m = new Map<string, number>();
    columns.forEach((c, idx) => c.statusIds.forEach((s) => m.set(s, idx)));
    return m;
  }, [columns]);
  const byKey = useMemo(() => new Map(issues.map((i) => [i.key, i])), [issues]);
  // Sprint issues arrive in rank order, so their index is their rank.
  const rankIndex = useMemo(() => new Map(allIssues.map((i, idx) => [i.key, idx])), [allIssues]);
  const rankOf = (key: string) => rankIndex.get(key) ?? Number.MAX_SAFE_INTEGER;

  const subtasksOf = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const i of issues) if (i.issuetype?.subtask && i.parent) m.set(i.parent.key, [...(m.get(i.parent.key) ?? []), i]);
    return m;
  }, [issues]);
  const allSubtasksOf = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const i of allIssues) if (i.issuetype?.subtask && i.parent) m.set(i.parent.key, [...(m.get(i.parent.key) ?? []), i]);
    return m;
  }, [allIssues]);

  const [flash, setFlash] = useState<Set<string>>(new Set());
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  const [hoverParent, setHoverParent] = useState<string | null>(null);

  // Unfolding a single story flashes its subtasks for a few seconds so they're easy to spot.
  const toggleStory = (key: string) => {
    const unfolding = collapsedStories.includes(key);
    onToggleStory(key);
    if (!unfolding) return;
    setFlash(new Set((subtasksOf.get(key) ?? []).map((s) => s.key)));
    clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(new Set()), 5000);
  };

  const isFolded = (i: Issue) => !!i.issuetype?.subtask && !!i.parent && collapsedStories.includes(i.parent.key);
  const grid: CSSProperties = { gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))` };

  /* ---------- drag & drop ---------- */

  const drag = useRef<DragState | null>(null);
  const [dropAt, setDropAt] = useState<DropAt | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const endDrag = () => {
    drag.current = null;
    setDropAt(null);
    setOverCell(null);
  };

  const transitionTo = async (key: string, colIdx: number) => {
    const issue = byKey.get(key);
    if (!issue || colOf.get(issue.status?.id ?? '') === colIdx) return;
    const col = columns[colIdx]!;
    try {
      const ts = await qc.fetchQuery({ queryKey: ['transitions', key], queryFn: () => api.transitions(key), staleTime: 30_000 });
      const t = ts.find((x) => col.statusIds.includes(x.to.id));
      if (!t) return toast(`${key} no puede pasar a «${col.name}» desde «${issue.status?.name}»`, 'error');
      transition(key, t);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  /** Over a unit: stories, tasks and placeholders reorder among the units of their own cell. */
  const unitDragOver = (e: React.DragEvent, unit: Unit, target: string, cellId: string) => {
    const d = drag.current;
    if (!d || d.kind === 'subtask' || d.cellId !== cellId) return;
    e.preventDefault();
    e.stopPropagation();
    if (target === d.rankKey || !rankIndex.has(target)) return setDropAt(null);
    setDropAt({ id: unit.id, pos: dropPos(e), target, cellId });
  };

  /** Over a subtask: only its siblings (same story, same cell) can be dropped around it. */
  const subtaskDragOver = (e: React.DragEvent, sub: Issue, cellId: string) => {
    const d = drag.current;
    if (!d || d.kind !== 'subtask' || d.cellId !== cellId || d.parentKey !== sub.parent?.key) return;
    e.preventDefault();
    e.stopPropagation();
    if (sub.key === d.key) return setDropAt(null);
    setDropAt({ id: sub.key, pos: dropPos(e), target: sub.key, cellId });
  };

  const cells = (group: Group) => {
    const perCol: Issue[][] = columns.map(() => []);
    for (const i of group.issues) {
      const idx = colOf.get(i.status?.id ?? '');
      if (idx !== undefined) perCol[idx]!.push(i);
    }
    return perCol;
  };

  return (
    <div className="board">
      <div className="board-inner" style={{ minWidth: columns.length * 268 + 24 }}>
        <div className="board-cols" style={grid}>
          {columns.map((c) => {
            const n = issues.filter((i) => !isFolded(i) && c.statusIds.includes(i.status?.id ?? '')).length;
            return (
              <div key={c.name} className="board-col-head">
                <span>{c.name}</span>
                <span className="muted">{n}</span>
              </div>
            );
          })}
        </div>
        {groups.map((g) => {
          const open = !collapsed.has(g.id);
          return (
            <section key={g.id} className="lane">
              {g.header !== null && (
                <div className="lane-head" onClick={() => onToggle(g.id)}>
                  <div className="lane-title">
                    <Icon.Chevron open={open} />
                    {g.header}
                    <Progress issues={g.issues} />
                  </div>
                </div>
              )}
              {open && (
                <div className="lane-cells" style={grid}>
                  {cells(g).map((list, colIdx) => {
                    const cellId = `${g.id}:${colIdx}`;
                    return (
                      <div
                        key={cellId}
                        className={`cell${overCell === cellId ? ' over' : ''}`}
                        onDragOver={(e) => {
                          const d = drag.current;
                          // Other columns accept cards and subtasks as a status change.
                          if (!d || d.kind === 'placeholder' || d.colIdx === colIdx) return;
                          e.preventDefault();
                          setOverCell(cellId);
                        }}
                        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOverCell(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const d = drag.current;
                          const at = dropAt;
                          endDrag();
                          if (!d) return;
                          if (at && at.cellId === cellId) rank(d.rankKey, at.pos, at.target);
                          else if (d.colIdx !== colIdx && d.kind !== 'placeholder') transitionTo(d.key, colIdx);
                        }}
                      >
                        {arrange(list, rankOf).map((unit) => {
                          const head = unit.head;
                          const storyKey = head.kind === 'card' ? head.issue.key : head.parent.key;
                          const folded = collapsedStories.includes(storyKey);
                          const startDrag = (kind: DragState['kind']) => () => {
                            drag.current = { key: storyKey, kind, rankKey: storyKey, cellId, colIdx };
                          };
                          return (
                            <div
                              key={unit.id}
                              className={`unit${dropAt?.id === unit.id ? ` drop-${dropAt.pos}` : ''}`}
                              onDragOver={(e) => unitDragOver(e, unit, storyKey, cellId)}
                            >
                              {head.kind === 'placeholder' ? (
                                <ParentPlaceholder
                                  parent={head.parent}
                                  subtaskCount={unit.subs.length}
                                  allSubtasks={allSubtasksOf.get(storyKey) ?? []}
                                  columns={allColumns}
                                  folded={folded}
                                  onToggle={() => toggleStory(storyKey)}
                                  onHover={setHoverParent}
                                  // Its position comes from the story's rank, which only exists if the story is in the sprint.
                                  draggable={rankIndex.has(storyKey)}
                                  drag={{ onDragStart: startDrag('placeholder'), onDragEnd: endDrag }}
                                />
                              ) : (
                                <Card
                                  issue={head.issue}
                                  showParent={showParent}
                                  subtaskCount={(subtasksOf.get(storyKey) ?? []).length}
                                  allSubtasks={allSubtasksOf.get(storyKey) ?? []}
                                  columns={allColumns}
                                  folded={folded}
                                  onToggleSubtasks={() => toggleStory(storyKey)}
                                  highlight={hoverParent === storyKey ? 'hover' : flash.has(storyKey) ? 'flash' : null}
                                  onDragStart={startDrag('card')}
                                  onDragEnd={endDrag}
                                />
                              )}
                              {!folded &&
                                unit.subs.map((s) => (
                                  <Card
                                    key={s.key}
                                    issue={s}
                                    showParent={false}
                                    subtaskCount={0}
                                    allSubtasks={[]}
                                    columns={allColumns}
                                    folded={false}
                                    onToggleSubtasks={() => {}}
                                    highlight={flash.has(s.key) ? 'flash' : null}
                                    onDragStart={() => {
                                      drag.current = { key: s.key, kind: 'subtask', rankKey: s.key, parentKey: s.parent?.key, cellId, colIdx };
                                    }}
                                    onDragEnd={endDrag}
                                    onDragOver={(e) => subtaskDragOver(e, s, cellId)}
                                    dropPos={dropAt?.id === s.key ? dropAt.pos : null}
                                  />
                                ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
