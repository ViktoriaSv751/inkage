'use client';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import { cloud, haptic, Preview } from '@/lib/store';

/** Recently deleted: nothing is lost by accident */
export function useTrash(load: () => Promise<Preview[]>) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [trash, setTrash] = useState<Preview[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoring, setRestoring] = useState('');
  const loadTrash = useCallback(() => {
    if (me.user) cloud.trash().then(setTrash).catch(() => {});
  }, [me.user]);
  useEffect(() => loadTrash(), [loadTrash]);
  const restore = async (p: Preview) => {
    setRestoring(p.id);
    try {
      if (!(await cloud.restore(p.id))) throw new Error();
      setTrash((x) => x.filter((y) => y.id !== p.id));
      await load();
      haptic('success');
      toast(t('Restored to your gallery', 'Visszaállítva a galériádba'));
    } catch {
      toast(t('Could not restore it. Try again.', 'Nem sikerült visszaállítani. Próbáld újra.'));
    }
    setRestoring('');
  };
  // emptying it is for good, in one tap; a single design can go for good from its own row
  const [purging, setPurging] = useState('');
  const purge = async (ids?: string[]) => {
    setPurging(ids ? ids[0] : 'all');
    try {
      await cloud.purgeTrash(ids);
      const left = ids ? trash.filter((p) => !ids.includes(p.id)) : [];
      setTrash(left);
      if (!left.length) setTrashOpen(false);
      haptic('success');
      toast(ids ? t('Deleted for good', 'Végleg törölve') : t('Recently deleted emptied', 'A Nemrég törölt kiürítve'));
    } catch {
      toast(t('Could not delete it. Try again.', 'Nem sikerült törölni. Próbáld újra.'));
    }
    setPurging('');
  };
  const closeTrash = () => setTrashOpen(false);
  return { trash, trashOpen, setTrashOpen, closeTrash, restoring, restore, purging, purge, loadTrash };
}
