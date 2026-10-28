import { useApp } from '../hooks';
import type { Issue } from '../types';
import { colorFor } from '../util';
import { Icon, PriorityIcon } from './icons';
import { AssigneePicker, LabelChips, StatusPicker } from './Pickers';

export function IssueRow({ issue, showParent = true }: { issue: Issue; showParent?: boolean }) {
  const { openIssue } = useApp();
  const extra = issue.labels.length - 2;
  return (
    <div
      className="row"
      role="button"
      tabIndex={0}
      onClick={() => openIssue(issue.key)}
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
    </div>
  );
}
