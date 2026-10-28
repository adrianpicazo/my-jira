import { useMemo, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useApp, useIssueActions } from '../hooks';
import { toast } from '../toast';
import type { Column, Issue } from '../types';
import { colorFor } from '../util';
import { Icon, PriorityIcon, StatusIcon } from './icons';
import { AssigneePicker, LabelChips } from './Pickers';
import { Progress } from './Progress';
import type { Group } from './SprintView';

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

function Card({ issue, showParent }: { issue: Issue; showParent: boolean }) {
  const { openIssue } = useApp();
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`card${dragging ? ' dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/issue-key', issue.key);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => openIssue(issue.key)}
    >
      <div className="card-title">
        {issue.issuetype?.subtask && <span className="muted">↳ </span>}
        {issue.summary}
      </div>
      {(issue.labels.length > 0 || (showParent && issue.parent)) && (
        <div className="card-chips">
          {showParent && issue.parent && (
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
    </div>
  );
}

export function SprintBoard({
  groups,
  columns: rawColumns,
  issues,
  collapsed,
  onToggle,
  showParent,
}: {
  groups: Group[];
  columns: Column[] | undefined;
  issues: Issue[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  showParent: boolean;
}) {
  const qc = useQueryClient();
  const { transition } = useIssueActions();
  const columns = useColumns(rawColumns, issues);
  const [over, setOver] = useState<string | null>(null);
  const colOf = useMemo(() => {
    const m = new Map<string, number>();
    columns.forEach((c, idx) => c.statusIds.forEach((s) => m.set(s, idx)));
    return m;
  }, [columns]);
  const byKey = useMemo(() => new Map(issues.map((i) => [i.key, i])), [issues]);
  const grid: CSSProperties = { gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))` };

  const drop = async (key: string, colIdx: number) => {
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
            const n = issues.filter((i) => c.statusIds.includes(i.status?.id ?? '')).length;
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
                  {cells(g).map((list, idx) => {
                    const id = `${g.id}:${idx}`;
                    return (
                      <div
                        key={id}
                        className={`cell${over === id ? ' over' : ''}`}
                        onDragOver={(e) => {
                          if (!e.dataTransfer.types.includes('text/issue-key')) return;
                          e.preventDefault();
                          setOver(id);
                        }}
                        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setOver(null);
                          drop(e.dataTransfer.getData('text/issue-key'), idx);
                        }}
                      >
                        {list.map((i) => (
                          <Card key={i.key} issue={i} showParent={showParent} />
                        ))}
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
