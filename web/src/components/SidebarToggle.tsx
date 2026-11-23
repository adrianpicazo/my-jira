import { createContext, useContext } from 'react';
import { Icon } from './icons';

export const SidebarContext = createContext<{ hidden: boolean; toggle: () => void } | null>(null);

/** Shows or hides the left sidebar. Sits at the start of each view's title. */
export function SidebarToggle() {
  const ctx = useContext(SidebarContext);
  if (!ctx) return null;
  return (
    <button className="icon-btn" title={`${ctx.hidden ? 'Mostrar' : 'Ocultar'} barra lateral ( [ )`} onClick={ctx.toggle}>
      <Icon.Sidebar />
    </button>
  );
}
