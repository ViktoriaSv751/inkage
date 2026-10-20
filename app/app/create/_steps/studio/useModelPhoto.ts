'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../../../AppProvider';
import { trErr } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { haptic, track } from '@/lib/store';
import { prepareImage } from '@/lib/client';
import { aiPlacement } from '@/lib/placements';
import type { Photo } from '../types';

/** The "Try it on a model" sheet: a generated stand-in photo of the body area. */
export function useModelPhoto(placement: string, usePhoto: (p: Photo) => void) {
  const { ui, toast } = useApp();
  const [modelOpen, setModelOpen] = useState(false);
  const [tone, setTone] = useState(3);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelImg, setModelImg] = useState<{ src: string; id?: number | null; tone: number } | null>(null);
  const [modelStep, setModelStep] = useState(0);
  useEffect(() => {
    if (!modelBusy) return setModelStep(0);
    const id = setInterval(() => setModelStep((n) => Math.min(n + 1, 3)), 2600);
    return () => clearInterval(id);
  }, [modelBusy]);
  // "I don't have a good photo": a stand-in photo of that body area in the chosen skin tone
  const modelPhoto = async (another = false) => {
    setModelBusy(true);
    track('model_photo', { tone, another });
    const r = await api<{ image?: string; id?: number | null; error?: string }>('/api/model-photo', {
      area: aiPlacement(placement),
      tone,
      // "another one": a fresh photo, never the same as the one on screen
      fresh: another,
      not: another ? modelImg?.id ?? null : null,
    });
    setModelBusy(false);
    if (!r.ok || !r.data.image) return toast(trErr(ui.lang, r.data?.error));
    haptic('success');
    setModelImg({ src: r.data.image, id: r.data.id, tone });
  };
  const useModel = async () => {
    if (!modelImg) return;
    const blob = await (await fetch(modelImg.src)).blob();
    const p = await prepareImage(new File([blob], 'model.jpg', { type: blob.type }), 1024);
    setModelOpen(false);
    setModelImg(null);
    usePhoto(p);
  };
  return { modelOpen, setModelOpen, tone, setTone, modelBusy, modelImg, modelStep, modelPhoto, useModel };
}
