import { useApp } from '../hooks';
import type { Column, Issue } from '../types';
import { colorFor } from '../util';
import { useHoverPreview } from './HoverPreview';
import { Icon, PriorityIcon } from './icons';
import { AssigneePicker, LabelChips, StatusPicker } from './Pickers';
import { SubtaskStats } from './SprintBoard';

export function IssueRow({
  issue,
  showParent = true,
  preview = false,
  subtasks,
  onContextMenu,
  drag,
}: {
  issue: Issue;
  showParent?: boolean;
  /** Show description and reporter after hovering for a while. */
  preview?: boolean;
  /** Folded subtasks, shown as a pending count with a per-status tooltip. */
  subtasks?: { issues: Issue[]; columns: Column[] };
  onContextMenu?: (e: React.MouseEvent) => void;
  drag?: {
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
    dropPos: 'before' | 'after' | null;
  };
}) {
  const { openIssue } = useApp();
  const extra = issue.labels.length - 2;
  const hover = useHoverPreview(issue.key, preview);
  return (
    <div
      className={`row${drag?.dropPos ? ` drop-${drag.dropPos}` : ''}`}
      draggable={!!drag}
      onMouseEnter={hover.handlers.onMouseEnter}
      onMouseLeave={hover.handlers.onMouseLeave}
      onMouseDown={hover.handlers.onMouseDown}
      onDragStart={(e) => {
        hover.handlers.onDragStart?.();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', issue.key);
        drag?.onDragStart();
      }}
      onDragEnd={drag?.onDragEnd}
      onDragOver={drag?.onDragOver}
      role="button"
      tabIndex={0}
      onClick={() => openIssue(issue.key)}
      onContextMenu={(e) => {
        hover.handlers.onContextMenu?.();
        onContextMenu?.(e);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && openIssue(issue.key)}
    >
      <span className="row-priority" title={issue.priority?.name}>
        <PriorityIcon name={issue.priority?.name} />
      </span>
      <span className="row-key">{issue.key}</span>
      <StatusPicker issueKey={issue.key} status={issue.status} />
      <span className="row-title">
        {issue.issuetype?.subtask && <span className="muted">↳ </span>}
        {issue.summary}
      </span>
      {subtasks && subtasks.issues.length > 0 && (
        <span className="row-subtasks">
          <SubtaskStats subtasks={subtasks.issues} columns={subtasks.columns} />
        </span>
      )}
      <span className="row-meta">
        <LabelChips labels={issue.labels.slice(0, 2)} />
        {extra > 0 && <span className="chip">+{extra}</span>}
        {showParent && issue.parent && (
          <span className="chip chip-parent" title={`${issue.parent.key} · ${issue.parent.summary}`}>
            <Icon.Epic color={colorFor(issue.parent.key)} size={10} />
            <span className="ellipsis">{issue.parent.summary}</span>
          </span>
        )}
      </span>
      <AssigneePicker issueKey={issue.key} assignee={issue.assignee} />
      {hover.preview}
    </div>
  );
}
