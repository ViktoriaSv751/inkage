'use client';
import { useApp } from '../AppProvider';
import { Icon } from '../ui';
import { tx } from '@/lib/i18n';

/** The top of the two creating steps: back (or the beta note), the step dots, the title and the line under it. */
export function StepHead({ title, sub, back, stepIdx }: { title: string; sub: string; back?: () => void; stepIdx: number }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <>
      <div className="stephead">
        {back ? (
          <button className="iconbtn" aria-label={ui.t('common.back')} onClick={back}>
            {Icon.back}
          </button>
        ) : (
          <span className="free-pill">
            {t('✦ Free while in beta', '✦ Ingyenes a tesztidőszakban')}
          </span>
        )}
        <div className="dots" aria-label={`${stepIdx + 1} / 2`}>
          {[0, 1].map((i) => (
            <i key={i} className={i === stepIdx ? 'on' : ''} />
          ))}
        </div>
      </div>
      <h1>{title}</h1>
      <p className="sub">{sub}</p>
    </>
  );
}
