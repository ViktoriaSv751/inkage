'use client';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';

export type Tab = 'previews' | 'skin' | 'invite' | 'settings';

/** The four tab buttons under the header. */
export function ProfileTabs({ tab, setTab }: { tab: Tab; setTab: (v: Tab) => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <div className="pf-tabs" role="tablist">
      {(
        [
          ['previews', t('Previews', 'Előnézetek'), <path key="a" d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />],
          ['skin', t('Skin & lifestyle', 'Bőr és életmód'), <path key="b" d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />],
          ['invite', t('Invite', 'Meghívás'), <path key="c" d="M4 10h16v10H4zM2 7h20v3H2zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0" />],
          ['settings', t('Settings', 'Beállítások'), <path key="d" d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />],
        ] as const
      ).map(([k, label, icon]) => (
        <button key={k} role="tab" aria-selected={tab === k} aria-label={label} title={label} className={tab === k ? 'on' : ''} onClick={() => setTab(k as any)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {icon}
          </svg>
          <span className="pf-tab-l">{label}</span>
        </button>
      ))}
    </div>
  );
}
