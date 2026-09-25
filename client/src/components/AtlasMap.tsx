import { LibreAtlasMap } from './LibreAtlasMap';
import { PaperMap } from './PaperMap';

export type { AtlasProps, Outline, PaperPlace, Projector } from './AtlasLayer';

/** The map every page uses: keyless vector tiles by default, SVG paper with VITE_PAPER=1. */
export const AtlasMap = import.meta.env.VITE_PAPER === '1' ? PaperMap : LibreAtlasMap;
