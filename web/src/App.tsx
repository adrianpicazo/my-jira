import { useCallback, useMemo } from 'react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { AppContext, useLocalStorage, useRoute, type AppCtx, type View } from './hooks';
import { useToasts } from './toast';
import type { Board, Me } from './types';
import { Avatar, Icon } from './components/icons';
import { BacklogView } from './components/BacklogView';
import { IssuePanel } from './components/IssuePanel';
import { Menu } from './components/Menu';
import { Popover } from './components/Popover';
import { SprintView } from './components/SprintView';

function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function Setup({ message }: { message: string }) {
  return (
    <div className="setup">
      <h1>Conectar con Jira</h1>
      <p className="error">{message}</p>
      <ol>
        <li>
          Crea un API token en{' '}
          <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
            id.atlassian.com
          </a>
          .
        </li>
        <li>
          Copia <code>.env.example</code> a <code>.env</code> y rellena <code>JIRA_BASE_URL</code>, <code>JIRA_EMAIL</code> y <code>JIRA_API_TOKEN</code>.
        </li>
        <li>
          Reinicia <code>npm run dev</code>.
        </li>
      </ol>
    </div>
  );
}

function Sidebar({ me, board, boards, onBoard, view, onView }: { me: Me; board: Board; boards: Board[]; onBoard: (id: number) => void; view: View; onView: (v: View) => void }) {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  return (
    <nav className="sidebar">
      <Popover
        width={280}
        renderTrigger={(p) => (
          <button className="workspace" {...p}>
            <span className="workspace-logo">L</span>
            <span className="ellipsis">{board.name}</span>
            <Icon.Chevron open />
          </button>
        )}
      >
        {(close) => (
          <Menu
            placeholder="Cambiar de board…"
            items={boards.map((b) => ({ id: String(b.id), label: b.name, hint: b.projectKey, selected: b.id === board.id }))}
            onSelect={(i) => {
              onBoard(Number(i.id));
              close();
            }}
          />
        )}
      </Popover>
      <div className="nav">
        <button className={`nav-item${view === 'sprint' ? ' on' : ''}`} onClick={() => onView('sprint')}>
          <Icon.Sprint /> Sprint actual
        </button>
        <button className={`nav-item${view === 'backlog' ? ' on' : ''}`} onClick={() => onView('backlog')}>
          <Icon.Backlog /> Backlog
        </button>
      </div>
      <div className="sidebar-foot">
        <span className="me">
          <Avatar user={me} size={20} />
          <span className="ellipsis">{me.displayName}</span>
        </span>
        <button className={`icon-btn${fetching ? ' spinning' : ''}`} title="Refrescar" onClick={() => qc.invalidateQueries()}>
          <Icon.Refresh />
        </button>
      </div>
    </nav>
  );
}

export function App() {
  const { view, issue, navigate } = useRoute();
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: Infinity, retry: false });
  const boardsQ = useQuery({ queryKey: ['boards'], queryFn: api.boards, staleTime: Infinity, enabled: meQ.isSuccess });
  const [boardId, setBoardId] = useLocalStorage<number | null>('boardId', null);
  const boards = boardsQ.data ?? [];
  const board = boards.find((b) => b.id === boardId) ?? boards[0];

  const sprintsQ = useQuery({
    queryKey: ['sprints', board?.id],
    queryFn: () => api.sprints(board!.id),
    enabled: !!board,
    staleTime: 5 * 60_000,
  });
  const sprints = useMemo(() => sprintsQ.data ?? [], [sprintsQ.data]);
  const [hiddenStore, setHiddenStore] = useLocalStorage<Record<string, number[]>>('hiddenSprintIds', {});
  const hiddenSprintIds = (board && hiddenStore[board.id]) ?? [];

  const openIssue = useCallback((key: string) => navigate(view, key), [navigate, view]);
  const closeIssue = useCallback(() => navigate(view, null), [navigate, view]);

  if (meQ.error) return <Setup message={(meQ.error as Error).message} />;
  if (boardsQ.error) return <Setup message={(boardsQ.error as Error).message} />;
  if (!meQ.data || !board || !sprintsQ.data) {
    return <div className="boot">{boardsQ.isSuccess && !boards.length ? 'No hay boards accesibles.' : 'Cargando…'}</div>;
  }

  const ctx: AppCtx = {
    me: meQ.data,
    board,
    sprints,
    hiddenSprintIds,
    setHiddenSprintIds: (ids) => setHiddenStore({ ...hiddenStore, [board.id]: ids }),
    openIssue,
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <Sidebar me={meQ.data} board={board} boards={boards} onBoard={setBoardId} view={view} onView={(v) => navigate(v, null)} />
        <div className="main">{view === 'sprint' ? <SprintView /> : <BacklogView />}</div>
        {issue && <IssuePanel key={issue} issueKey={issue} onClose={closeIssue} onOpen={openIssue} />}
        <Toasts />
      </div>
    </AppContext.Provider>
  );
}
