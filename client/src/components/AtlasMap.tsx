import { MOCK } from '../api';
import { GoogleAtlasMap } from './GoogleAtlasMap';
import { PaperMap } from './PaperMap';

export type { AtlasProps, Outline, PaperPlace, Projector } from './AtlasLayer';

/** The map every page uses: Google when a browser key is configured, SVG paper otherwise. */
export const AtlasMap = MOCK ? PaperMap : GoogleAtlasMap;
