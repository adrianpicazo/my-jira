import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useIssueActions, useLocalStorage } from '../hooks';
import { toast } from '../toast';
import type { ExtraField, IssueDetail } from '../types';
import { colorFor, fmtDay, fmtFull, relTime } from '../util';
import { Avatar, Icon, PriorityIcon } from './icons';
import { IssueRow } from './IssueRow';
import { MentionTextarea, useMentions } from './MentionTextarea';
import { AssigneePicker, LabelsPicker, ParentPicker, SprintPicker, StatusPicker } from './Pickers';

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

const isSave = (e: React.KeyboardEvent) => e.key === 'Enter' && (e.metaKey || e.ctrlKey);

function Title({ issue }: { issue: IssueDetail }) {
  const { update } = useIssueActions();
  const [draft, setDraft] = useState(issue.summary);
  useEffect(() => setDraft(issue.summary), [issue.summary]);
  const save = () => {
    const v = draft.trim();
    if (!v) return setDraft(issue.summary);
    if (v !== issue.summary) update(issue.key, { summary: v }, { summary: v });
  };
  return (
    <AutoTextarea
      className="title-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ''))}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          setDraft(issue.summary);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function Description({ issue }: { issue: IssueDetail }) {
  const { update } = useIssueActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(issue.description);
  const [saving, setSaving] = useState(false);
  const mentions = useMentions();
  useEffect(() => {
    if (!editing) setDraft(issue.description);
  }, [issue.description, editing]);

  const save = async () => {
    setSaving(true);
    try {
      if (await update(issue.key, { description: mentions.toWiki(draft) })) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return issue.descriptionHtml ? (
      <div className="prose clickable" title="Clic para editar" onClick={(e) => !(e.target as HTMLElement).closest('a') && setEditing(true)} dangerouslySetInnerHTML={{ __html: issue.descriptionHtml }} />
    ) : (
      <button className="placeholder" onClick={() => setEditing(true)}>
        Añadir descripción…
      </button>
    );
  }
  return (
    <div className="editor">
      <MentionTextarea
        autoFocus
        issueKey={issue.key}
        mentions={mentions}
        value={draft}
        onChange={setDraft}
        onKeyDown={(e) => {
          if (isSave(e)) save();
          else if (e.key === 'Escape') {
            e.stopPropagation();
            setEditing(false);
          }
        }}
      />
      <div className="editor-actions">
        <span className="muted small">Formato wiki de Jira: *negrita* _cursiva_ {'{code}'} [enlace|url] · @ mencionar · ⌘↵ guardar</span>
        <button className="btn btn-ghost" onClick={() => setEditing(false)}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          Guardar
        </button>
      </div>
    </div>
  );
}

function Children({ issue }: { issue: IssueDetail }) {
  // Under ['issues', …] so status/assignee changes made from here patch it optimistically.
  const { data, isLoading } = useQuery({ queryKey: ['issues', 'children', issue.key], queryFn: () => api.children(issue.key) });
  if (issue.issuetype?.subtask || (!isLoading && !data?.length)) return null;
  const done = data?.filter((i) => i.status?.category === 'done').length ?? 0;
  return (
    <div className="children">
      <h3>
        {(issue.issuetype?.hierarchyLevel ?? 0) > 0 ? 'Issues de la épica' : 'Subtareas'}
        {data && (
          <span className="muted">
            {done}/{data.length}
          </span>
        )}
      </h3>
      {isLoading ? (
        <div className="muted small">Cargando…</div>
      ) : (
        <div className="children-list">
          {data!.map((i) => (
            <IssueRow key={i.key} issue={i} showParent={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function Comments({ issue }: { issue: IssueDetail }) {
  const { comment } = useIssueActions();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const mentions = useMentions();
  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      if (await comment(issue.key, mentions.toWiki(draft))) {
        setDraft('');
        mentions.reset();
      }
    } finally {
      setSending(false);
    }
  };
  const [tab, setTab] = useLocalStorage<'comments' | 'history'>('activityTab', 'comments');
  return (
    <div className="comments">
      <div className="activity-head">
        <h3>Actividad</h3>
        <div className="tabs">
          <button className={`tab${tab === 'comments' ? ' on' : ''}`} onClick={() => setTab('comments')}>
            Comentarios
          </button>
          <button className={`tab${tab === 'history' ? ' on' : ''}`} onClick={() => setTab('history')}>
            Historial
          </button>
        </div>
      </div>
      {tab === 'history' ? <History issueKey={issue.key} /> : <>
      {issue.comments.map((c) => (
        <div key={c.id} className="comment">
          <Avatar user={c.author} size={22} />
          <div className="comment-body">
            <div className="comment-meta">
              <strong>{c.author?.displayName ?? 'Desconocido'}</strong>
              <span className="muted" title={fmtFull(c.created)}>
                {relTime(c.created)}
              </span>
            </div>
            <div className="prose" dangerouslySetInnerHTML={{ __html: c.bodyHtml }} />
          </div>
        </div>
      ))}
      <div className="composer">
        <MentionTextarea
          issueKey={issue.key}
          mentions={mentions}
          value={draft}
          placeholder="Escribe un comentario… (@ para mencionar)"
          onChange={setDraft}
          onKeyDown={(e) => {
            if (isSave(e)) send();
            if (e.key === 'Escape') e.stopPropagation();
          }}
        />
        <div className="editor-actions">
          <span className="muted small">⌘↵ enviar</span>
          <button className="btn btn-primary" disabled={sending || !draft.trim()} onClick={send}>
            Comentar
          </button>
        </div>
      </div>
      </>}
    </div>
  );
}

// Jira's own field ids for the usual fields; custom fields already come with their display name.
const FIELD_NAMES: Record<string, string> = {
  status: 'Estado',
  assignee: 'Responsable',
  reporter: 'Informador',
  summary: 'Título',
  description: 'Descripción',
  labels: 'Etiquetas',
  priority: 'Prioridad',
  resolution: 'Resolución',
  issuetype: 'Tipo',
  IssueParentAssociation: 'Padre',
  Parent: 'Padre',
  'Parent Link': 'Padre',
  Rank: 'Rango',
  duedate: 'Fecha de vencimiento',
  timespent: 'Tiempo registrado',
  timeestimate: 'Estimación restante',
  timeoriginalestimate: 'Estimación original',
  WorklogId: 'Registro de trabajo',
  Attachment: 'Adjunto',
  Link: 'Enlace',
  Comment: 'Comentario',
};

function History({ issueKey }: { issueKey: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['issue', issueKey, 'history'], queryFn: () => api.history(issueKey) });
  if (isLoading) return <div className="muted small">Cargando…</div>;
  if (error) return <div className="muted small">{(error as Error).message}</div>;
  if (!data?.length) return <div className="muted small">Sin cambios.</div>;
  return (
    <div className="history">
      {data.map((h) => (
        <div key={h.id} className="history-entry">
          <Avatar user={h.author} size={22} />
          <div className="history-body">
            <div className="comment-meta">
              <strong>{h.author?.displayName ?? 'Automatización'}</strong>
              <span className="muted" title={fmtFull(h.created)}>
                {relTime(h.created)}
              </span>
            </div>
            {h.items.map((i, idx) => (
              <div key={idx} className="history-item">
                <span className="history-field">{FIELD_NAMES[i.field] ?? i.field}</span>
                {i.from && <span className="history-from">{i.from}</span>}
                {i.from && i.to && <span className="muted">→</span>}
                {i.to ? <span className="history-to">{i.to}</span> : !i.from && <span className="muted">—</span>}
                {i.from && !i.to && <span className="muted">(quitado)</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function tzOffset(d: Date) {
  const m = -d.getTimezoneOffset();
  const abs = Math.abs(m);
  return `${m >= 0 ? '+' : '-'}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`;
}

function Worklog({ issue }: { issue: IssueDetail }) {
  const { worklog } = useIssueActions();
  const [open, setOpen] = useState(false);
  const today = new Date().toLocaleDateString('sv');
  const [time, setTime] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const tt = issue.timetracking;

  const submit = async () => {
    if (!/^\s*(\d+(\.\d+)?\s*[wdhm]\s*)+$/i.test(time)) return toast('Formato de tiempo: 1h 30m, 2h, 45m, 1d', 'error');
    const now = new Date();
    const started = new Date(`${date}T${now.toTimeString().slice(0, 8)}`);
    const iso = `${date}T${now.toTimeString().slice(0, 8)}.000${tzOffset(started)}`;
    if (!(await worklog(issue.key, { timeSpent: time.trim(), started: iso, comment: note.trim() || undefined }))) return;
    setTime('');
    setNote('');
    setOpen(false);
  };

  return (
    <div className="worklog">
      <div className="worklog-stats">
        <span>
          <span className="muted">Registrado</span> {tt.timeSpent ?? '—'}
        </span>
        <span>
          <span className="muted">Restante</span> {tt.remainingEstimate ?? '—'}
        </span>
        {tt.originalEstimate && (
          <span>
            <span className="muted">Estimado</span> {tt.originalEstimate}
          </span>
        )}
      </div>
      {open ? (
        <form
          className="worklog-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input autoFocus placeholder="1h 30m" value={time} onChange={(e) => setTime(e.target.value)} />
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          <input placeholder="¿Qué has hecho? (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="editor-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!time.trim()}>
              Registrar
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-ghost full" onClick={() => setOpen(true)}>
          <Icon.Clock /> Registrar tiempo
        </button>
      )}
    </div>
  );
}

function FieldValue({ field }: { field: ExtraField }) {
  if (field.html) return <div className="static prose field-html" dangerouslySetInnerHTML={{ __html: field.html }} />;
  if (!field.text) return <span className="static muted">—</span>;
  const text = field.type === 'datetime' ? fmtFull(field.text) : field.type === 'date' ? fmtDay(field.text) : field.text;
  return <span className="static field-text">{text}</span>;
}

/**
 * The rest of the issue's Jira fields (read-only), folded by default. Any of them can be pinned
 * so it shows up with the main properties of every issue.
 */
function MoreFields({ issueKey }: { issueKey: string }) {
  const { data: fields } = useQuery({ queryKey: ['issue', issueKey, 'fields'], queryFn: () => api.fields(issueKey) });
  const [pinned, setPinned] = useLocalStorage<string[]>('pinnedFields', []);
  const [open, setOpen] = useLocalStorage('moreFieldsOpen', false);
  if (!fields?.length) return null;
  const togglePin = (id: string) => setPinned(pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id]);
  const row = (f: ExtraField) => (
    <div key={f.id} className="prop extra-field">
      <span className="prop-label" title={f.name}>
        {f.name}
      </span>
      <div className="prop-value">
        <FieldValue field={f} />
      </div>
      <button
        className="icon-btn pin-btn"
        title={pinned.includes(f.id) ? 'Devolver a «Más campos»' : 'Mostrar siempre arriba'}
        onClick={() => togglePin(f.id)}
      >
        {pinned.includes(f.id) ? <Icon.Close size={12} /> : <Icon.Pin size={12} />}
      </button>
    </div>
  );
  const shown = pinned.map((id) => fields.find((f) => f.id === id)).filter((f): f is ExtraField => !!f);
  const rest = fields.filter((f) => !pinned.includes(f.id));
  return (
    <>
      {shown.map(row)}
      {rest.length > 0 && (
        <div className="more-fields">
          <button className="more-fields-toggle" onClick={() => setOpen(!open)}>
            <Icon.Chevron open={open} size={11} /> Más campos <span className="muted">{rest.length}</span>
          </button>
          {open && rest.map(row)}
        </div>
      )}
    </>
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="prop">
      <span className="prop-label">{label}</span>
      <div className="prop-value">{children}</div>
    </div>
  );
}

export function IssuePanel({ issueKey, onClose, onOpen }: { issueKey: string; onClose: () => void; onOpen: (key: string) => void }) {
  const { data: issue, error, isLoading } = useQuery({ queryKey: ['issue', issueKey], queryFn: () => api.issue(issueKey) });

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);

  return (
    <div className="panel-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="panel">
        <header className="panel-header">
          <div className="crumbs">
            {issue?.project.key && <span className="muted">{issue.project.name}</span>}
            {issue?.parent && (
              <>
                <span className="muted">›</span>
                <button className="crumb" onClick={() => onOpen(issue.parent!.key)}>
                  <Icon.Epic color={colorFor(issue.parent.key)} size={10} /> {issue.parent.key}
                </button>
              </>
            )}
            <span className="muted">›</span>
            <button
              className="copy-key"
              title="Copiar enlace a Jira"
              disabled={!issue}
              onClick={() => issue && navigator.clipboard.writeText(issue.url).then(() => toast(`Enlace a ${issueKey} copiado`))}
            >
              {issueKey}
              <Icon.Link size={13} />
            </button>
          </div>
          <div className="panel-actions">
            <button
              className="icon-btn"
              title="Copiar clave"
              onClick={() => navigator.clipboard.writeText(issueKey).then(() => toast(`${issueKey} copiado`))}
            >
              <Icon.Copy />
            </button>
            {issue && (
              <a className="icon-btn" href={issue.url} target="_blank" rel="noreferrer" title="Abrir en Jira">
                <Icon.External />
              </a>
            )}
            <button className="icon-btn" title="Cerrar (Esc)" onClick={onClose}>
              <Icon.Close />
            </button>
          </div>
        </header>
        {isLoading && <div className="empty">Cargando…</div>}
        {error && <div className="empty error">{(error as Error).message}</div>}
        {issue && (
          <div className="panel-body">
            <main className="panel-main">
              <Title issue={issue} />
              <Description issue={issue} />
              <Children issue={issue} />
              <Comments issue={issue} />
            </main>
            <aside className="panel-side">
              <Prop label="Estado">
                <StatusPicker issueKey={issue.key} status={issue.status} variant="field" />
              </Prop>
              <Prop label="Responsable">
                <AssigneePicker issueKey={issue.key} assignee={issue.assignee} variant="field" />
              </Prop>
              <Prop label="Etiquetas">
                <LabelsPicker issueKey={issue.key} labels={issue.labels} />
              </Prop>
              <Prop label="Sprint">
                <SprintPicker issueKey={issue.key} sprint={issue.sprint} />
              </Prop>
              <Prop label={issue.issuetype?.subtask ? 'Historia' : 'Épica'}>
                <ParentPicker issueKey={issue.key} project={issue.project.key} parent={issue.parent} subtask={!!issue.issuetype?.subtask} />
              </Prop>
              <Prop label="Tipo">
                <span className="static">
                  {issue.issuetype?.icon && <img src={issue.issuetype.icon} width={14} height={14} alt="" />}
                  {issue.issuetype?.name}
                </span>
              </Prop>
              <Prop label="Prioridad">
                <span className="static">
                  <PriorityIcon name={issue.priority?.name} /> {issue.priority?.name ?? '—'}
                </span>
              </Prop>
              <Prop label="Informador">
                <span className="static">
                  <Avatar user={issue.reporter} size={16} /> {issue.reporter?.displayName ?? '—'}
                </span>
              </Prop>
              <MoreFields issueKey={issue.key} />
              <div className="side-sep" />
              <Worklog issue={issue} />
              <div className="side-foot muted small">Actualizado {relTime(issue.updated)}</div>
            </aside>
          </div>
        )}
      </aside>
    </div>
  );
}
