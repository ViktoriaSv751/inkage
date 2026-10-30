// AI helpers (prompts, image providers, photo and design checks); the pieces live in lib/ai/.
export { STAGES, REMOVAL, type Stage, type RemovalStage, type Analysis } from './ai/types';
export { freshPrompt, placedPrompt, stageYears, agePrompt, removalPrompt, improvePrompt, extractPrompt, designPrompt, REDO } from './ai/prompts';
export {
  dataUrlToImg,
  aiConfigured,
  imageModels,
  textModels,
  fastImageModels,
  secondaryImageModels,
  editImage,
  makeImage,
  makeImageFast,
  friendlyAiError,
} from './ai/providers';
export { analyse, inputSafety, checkPhoto, designBlocked, DESIGN_BLOCKED, type PhotoCheck } from './ai/photo-checks';
export { qualityCheck, findTattoos, extractCheck, type QC, type Found } from './ai/design-checks';
