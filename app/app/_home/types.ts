import type { Preview } from '@/lib/store';

export type Phase = 'loading' | 'onboarding' | 'studio' | 'place' | 'gen' | 'result';
export type JobMeta = Pick<Preview, 'placement' | 'mode' | 'size' | 'sizeCm' | 'design' | 'focus' | 'colorMode'>;
/** The running preview job: the token and fresh image the aging stages continue from. */
export type Job = { token: string; fresh: string; id?: string };
