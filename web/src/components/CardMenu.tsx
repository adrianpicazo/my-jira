import { useApp, useIssueActions } from '../hooks';
import { toast } from '../toast';
import type { Issue } from '../types';
import { ContextMenu, type ContextEntry } from './ContextMenu';
import { Icon, StatusIcon } from './icons';
import { Menu, type MenuItem } from './Menu';
import { LabelsMenu, StatusMenu } from './Pickers';

export interface RankMove {
  pos: 'before' | 'after';
  target: string;
}

export interface CardMenuState {
  x: number;
  y: number;
  issue: Issue;
  /** Where "top/bottom of the column" ranks it, if it isn't already there. */
  top?: RankMove;
  bottom?: RankMove;
}

const copy = (text: string, msg: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast(msg),
    () => toast('No se pudo copiar', 'error'),
  );

export function CardMenu({ state, currentSprintId, onClose }: { state: CardMenuState; currentSprintId?: number; onClose: () => void }) {
  const { me, sprints, hiddenSprintIds } = useApp();
  const { rank, moveToSprint, deleteIssue } = useIssueActions();
  const { issue, top, bottom } = state;
  const subtask = !!issue.issuetype?.subtask;

  const moveItems: MenuItem[] = [
    ...(top ? [{ id: 'top', label: 'Arriba de la columna', icon: <Icon.ArrowUp size={13} /> }] : []),
    ...(bottom ? [{ id: 'bottom', label: 'Abajo de la columna', icon: <Icon.ArrowDown size={13} /> }] : []),
    // Subtasks always live in their story's sprint.
    ...(subtask
      ? []
      : [
          ...sprints
            .filter((s) => s.id !== currentSprintId && !hiddenSprintIds.includes(s.id))
            .map((s) => ({ id: `s:${s.id}`, label: s.name, icon: <Icon.Sprint size={13} />, hint: s.state === 'active' ? 'Activo' : undefined })),
          { id: 'backlog', label: 'Backlog', icon: <Icon.Backlog size={13} /> },
        ]),
  ];

  const items: ContextEntry[] = [
    {
      label: 'Mover',
      icon: <Icon.Move />,
      submenu: (close) => (
        <Menu
          placeholder="Mover a…"
          items={moveItems}
          onSelect={(item) => {
            close();
            if (item.id === 'top' && top) rank(issue.key, top.pos, top.target);
            else if (item.id === 'bottom' && bottom) rank(issue.key, bottom.pos, bottom.target);
            else if (item.id === 'backlog') moveToSprint(issue.key, null);
            else moveToSprint(issue.key, sprints.find((s) => `s:${s.id}` === item.id) ?? null);
          }}
        />
      ),
    },
    {
      label: 'Cambiar estado',
      icon: <StatusIcon status={issue.status} />,
      submenu: (close) => <StatusMenu issueKey={issue.key} status={issue.status} close={close} />,
    },
    'separator',
    { label: 'Copiar enlace', icon: <Icon.Link />, onSelect: () => copy(`${me.baseUrl}/browse/${issue.key}`, 'Enlace copiado') },
    { label: 'Copiar clave', icon: <Icon.Copy />, onSelect: () => copy(issue.key, `${issue.key} copiado`) },
    'separator',
    { label: 'Editar etiquetas', icon: <Icon.Tag />, submenu: () => <LabelsMenu issueKey={issue.key} labels={issue.labels} /> },
    'separator',
    {
      label: 'Eliminar',
      icon: <Icon.Trash />,
      danger: true,
      onSelect: () => {
        const extra = subtask ? '' : '\nSi tiene subtareas, también se eliminarán.';
        if (window.confirm(`¿Eliminar ${issue.key} «${issue.summary}»?${extra}\nNo se puede deshacer.`)) deleteIssue(issue.key);
      },
    },
  ];

  return <ContextMenu x={state.x} y={state.y} items={items} onClose={onClose} />;
}
