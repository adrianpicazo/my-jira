import { useApp } from '../hooks';
import { fmtRange } from '../util';
import { Icon } from './icons';
import { Menu } from './Menu';
import { Popover } from './Popover';

/** Lets the user choose which sprints are hidden everywhere; persisted per board in localStorage. */
export function SprintFilter() {
  const { sprints, hiddenSprintIds, setHiddenSprintIds } = useApp();
  const hiddenCount = sprints.filter((s) => hiddenSprintIds.includes(s.id)).length;
  return (
    <Popover
      width={320}
      align="end"
      renderTrigger={(p) => (
        <button className="btn btn-ghost" {...p}>
          <Icon.Filter /> Sprints{hiddenCount > 0 && <span className="badge">{hiddenCount} ocultos</span>}
        </button>
      )}
    >
      {() => (
        <Menu
          placeholder="Sprints visibles…"
          items={sprints.map((s) => ({
            id: String(s.id),
            label: s.name,
            icon: <Icon.Sprint size={14} />,
            hint: s.state === 'active' ? 'Activo' : fmtRange(s.startDate, s.endDate),
            selected: !hiddenSprintIds.includes(s.id),
          }))}
          onSelect={(item) => {
            const id = Number(item.id);
            setHiddenSprintIds(hiddenSprintIds.includes(id) ? hiddenSprintIds.filter((x) => x !== id) : [...hiddenSprintIds, id]);
          }}
        />
      )}
    </Popover>
  );
}
