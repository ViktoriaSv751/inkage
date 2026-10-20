import type { Preview } from '@/lib/store';

// the card shows how it looks now (fresh); the years are one tap away in the detail view
export const thumb = (p: Preview) => p.images.fresh || p.images.y10 || p.images.y50 || p.removal?.laser10 || '';
export const PAGE = 120;
export type Sort = 'new' | 'old' | 'score' | 'place';
export type Kind = 'any' | 'new' | 'existing' | 'removal';
export type Mode = 'browse' | 'compare' | 'select';
export const isRemoval = (p: Preview) => p.mode === 'removal' || (!!p.removal && !p.images.y10 && !p.images.y50);
