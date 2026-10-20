'use client';
import { useState } from 'react';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import { sb } from '@/lib/sb';

/** The Edit profile sheet: name and picture. */
export function useAccount() {
  const { ui, me, toast, profile, setProfile } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const meta = profile;
  const [editOpen, setEditOpen] = useState(false);
  const [nameIn, setNameIn] = useState('');
  const [accBusy, setAccBusy] = useState('');
  const openEdit = () => {
    setNameIn(meta.name);
    setEditOpen(true);
  };
  const saveName = async () => {
    const name = nameIn.trim().slice(0, 60);
    setAccBusy('name');
    // saved in profiles, not in the sign-in data: a Google / Apple sign-in would overwrite that with the provider's name
    const { data, error } = (await sb()?.rpc('set_display_name', { p_name: name })) || { data: null, error: new Error('offline') };
    setAccBusy('');
    if (error) return toast(t('Could not save your name. Try again.', 'Nem sikerült menteni a nevet. Próbáld újra.'));
    setProfile({ name: (data as string | null) || '' });
    toast(t('Saved', 'Mentve'));
  };
  const pickAvatar = async (file: File) => {
    if (!me.user) return;
    setAccBusy('avatar');
    try {
      const { shrink } = await import('@/lib/store');
      const url = URL.createObjectURL(await import('@/lib/client').then((m) => m.decodable(file)));
      const blob = await shrink(url, 512, 0.86);
      URL.revokeObjectURL(url);
      const path = `${me.user.id}/profile/avatar.jpg`;
      const s = sb()!;
      const up = await s.storage.from('previews').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      await s.auth.updateUser({ data: { avatar_path: path } });
      const signed = (await s.storage.from('previews').createSignedUrl(path, 60 * 60 * 24)).data?.signedUrl ?? null;
      setProfile({ avatar: signed ? `${signed}&v=${Date.now()}` : null });
      toast(t('Profile picture updated', 'Profilkép frissítve'));
    } catch {
      toast(t('Could not upload the picture. Try another one.', 'Nem sikerült feltölteni a képet. Próbálj másikat.'));
    }
    setAccBusy('');
  };
  const removeAvatar = async () => {
    if (!me.user) return;
    const s = sb()!;
    await s.storage.from('previews').remove([`${me.user.id}/profile/avatar.jpg`]);
    await s.auth.updateUser({ data: { avatar_path: null } });
    setProfile({ avatar: null });
  };

  return { editOpen, setEditOpen, nameIn, setNameIn, accBusy, openEdit, saveName, pickAvatar, removeAvatar };
}
