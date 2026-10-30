import type { Preview, RemovalKey, StageKey } from '@/lib/store';

export type ResultProps = {
  preview: Preview;
  pending?: StageKey[];
  failed?: StageKey[];
  onNotes?: (s: string) => void;
  onFavorite?: () => void;
  onRetryStage?: (k: StageKey) => void;
  onNew?: () => void;
  reveal?: boolean;
  /** "Make it last": redraw the design and try again */
  onImprove?: () => void;
  improving?: boolean;
  /** try again at a suggested width in cm */
  onResize?: (cm: number) => void;
  /** start the laser-removal preview */
  onRemoval?: () => void;
  removalPending?: RemovalKey[];
  /** which tab opens first */
  startView?: 'aging' | 'removal';
  /** "Not right?": make it again, avoiding what the user ticked */
  onRedo?: (reasons: string[]) => void;
  /** a cloud preview got (or lost) its vote link */
  onShared?: (shareId: string | null) => void;
  /** "I got it done": the date the tattoo was made */
  onDone?: (date: string) => void;
  /** removal-only preview: also run the aging stages */
  onAging?: () => void;
  /** opened from the gallery: the years can be made or finished here */
  gallery?: boolean;
  /** try the same design on another body area (new photo of that spot) */
  onTryPlace?: (placement: string) => void;
};

export type ShareInfo = { votes?: { yes: number; no: number; change: number } } | null;
