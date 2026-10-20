'use client';
import { useState } from 'react';
import { useApp } from '../../../AppProvider';
import { trErr } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { track } from '@/lib/store';
import type { Design } from '../types';

/** AI drawing state and actions. Nothing on the screen uses them at the moment (the drawing UI was removed);
    kept as they were so this split changes no behaviour. */
export function useAiDrawing(design: Design | null, applyDesign: (raw: string, mode: Design['mode'], libId?: string) => Promise<void>) {
  const { ui, toast } = useApp();
  const [prompt, setPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState<'fine-line' | 'blackwork' | 'traditional'>('fine-line');
  const [drawing, setDrawing] = useState(false);
  // AI drawings: two variants to choose from, then "like this, but…" changes
  const [variants, setVariants] = useState<string[]>([]);
  const [change, setChange] = useState('');
  const aiDesign = async () => {
    if (prompt.trim().length < 3) return;
    setDrawing(true);
    track('ai_design', { style: aiStyle });
    const r = await api<{ image: string; images?: string[]; error?: string }>('/api/design', { text: prompt, style: aiStyle });
    setDrawing(false);
    if (!r.ok || !r.data.image) return toast(trErr(ui.lang, r.data?.error));
    setVariants(r.data.images?.length ? r.data.images : [r.data.image]);
    await applyDesign(r.data.image, 'black');
  };
  const refine = async () => {
    if (!design || change.trim().length < 3) return;
    setDrawing(true);
    track('ai_design_change');
    const r = await api<{ image: string; error?: string }>('/api/design', { text: change, style: aiStyle, base: design.raw });
    setDrawing(false);
    if (!r.ok || !r.data.image) return toast(trErr(ui.lang, r.data?.error));
    setVariants((v) => [r.data.image, ...v].slice(0, 4));
    setChange('');
    await applyDesign(r.data.image, design.mode);
  };
  return { prompt, setPrompt, aiStyle, setAiStyle, drawing, variants, change, setChange, aiDesign, refine };
}
