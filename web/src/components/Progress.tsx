import type { Issue } from '../types';

export function Progress({ issues }: { issues: Issue[] }) {
  const done = issues.filter((i) => i.status?.category === 'done').length;
  const doing = issues.filter((i) => i.status?.category === 'indeterminate').length;
  const pct = (n: number) => `${issues.length ? (n / issues.length) * 100 : 0}%`;
  return (
    <span className="progress" title={`${done} hechas · ${doing} en curso · ${issues.length - done - doing} por hacer`}>
      <span className="progress-bar">
        <span style={{ width: pct(done), background: '#5e6ad2' }} />
        <span style={{ width: pct(doing), background: '#f2c94c' }} />
      </span>
      <span className="muted">
        {done}/{issues.length}
      </span>
    </span>
  );
}
