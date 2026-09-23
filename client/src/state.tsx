import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import {
  CATEGORIES,
  CATEGORY_KEYS,
  deriveRoutine,
  type BaselineResponse,
  type CategoryKey,
  type CityInfo,
  type Importance,
  type MatchResponse,
  type PlacePoint,
  type RoutineNode,
} from '@locus/shared';

export interface HomeInput {
  placeId: string;
  label: string;
}

export interface LocusState {
  home: HomeInput | null;
  anchor: HomeInput | null;
  city: CityInfo | null;
  baseline: BaselineResponse | null;
  importance: Record<CategoryKey, Importance>;
  removedPlaceIds: string[];
  droppedRoutineNodes: RoutineNode[];
  lensM: number;
  match: MatchResponse | null;
  compare: [number, number] | null;
}

type Action =
  | { type: 'setHome'; home: HomeInput | null }
  | { type: 'setAnchor'; anchor: HomeInput | null }
  | { type: 'setCity'; city: CityInfo | null }
  | { type: 'setBaseline'; baseline: BaselineResponse }
  | { type: 'setImportance'; category: CategoryKey; importance: Importance }
  | { type: 'removePlace'; placeId: string }
  | { type: 'undoRemove' }
  | { type: 'toggleRoutineNode'; node: RoutineNode }
  | { type: 'setLens'; lensM: number }
  | { type: 'setMatch'; match: MatchResponse | null }
  | { type: 'setCompare'; compare: [number, number] | null }
  | { type: 'reset' };

const defaultImportance = Object.fromEntries(
  CATEGORY_KEYS.map((k) => [k, CATEGORIES[k].defaultImportance]),
) as Record<CategoryKey, Importance>;

const initial: LocusState = {
  home: null,
  anchor: null,
  city: null,
  baseline: null,
  importance: defaultImportance,
  removedPlaceIds: [],
  droppedRoutineNodes: [],
  lensM: 1000,
  match: null,
  compare: null,
};

function reducer(s: LocusState, a: Action): LocusState {
  switch (a.type) {
    case 'setHome':
      return { ...s, home: a.home, baseline: null, match: null, removedPlaceIds: [] };
    case 'setAnchor':
      return { ...s, anchor: a.anchor, match: null };
    case 'setCity':
      return { ...s, city: a.city, match: null };
    case 'setBaseline':
      return { ...s, baseline: a.baseline, removedPlaceIds: [], match: null };
    case 'setImportance':
      return { ...s, importance: { ...s.importance, [a.category]: a.importance }, match: null };
    case 'removePlace':
      return s.removedPlaceIds.includes(a.placeId)
        ? s
        : { ...s, removedPlaceIds: [...s.removedPlaceIds, a.placeId], match: null };
    case 'undoRemove':
      return { ...s, removedPlaceIds: s.removedPlaceIds.slice(0, -1), match: null };
    case 'toggleRoutineNode':
      return {
        ...s,
        droppedRoutineNodes: s.droppedRoutineNodes.includes(a.node)
          ? s.droppedRoutineNodes.filter((n) => n !== a.node)
          : [...s.droppedRoutineNodes, a.node],
      };
    case 'setLens':
      return { ...s, lensM: a.lensM };
    case 'setMatch':
      return { ...s, match: a.match, compare: null };
    case 'setCompare':
      return { ...s, compare: a.compare };
    case 'reset':
      return initial;
  }
}

interface Derived {
  /** Baseline places minus the ones the user removed. */
  places: PlacePoint[];
  /** Per-category count after removals. */
  counts: Record<CategoryKey, number>;
  categories: { category: CategoryKey; baselineCount: number; importance: Importance }[];
  routine: RoutineNode[];
}

const Ctx = createContext<{ state: LocusState; dispatch: (a: Action) => void; derived: Derived } | null>(null);

export function LocusProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const derived = useMemo<Derived>(() => {
    const removed = new Set(state.removedPlaceIds);
    const places = (state.baseline?.places ?? []).filter((p) => !removed.has(p.placeId));
    const counts = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;
    for (const b of state.baseline?.baseline ?? []) counts[b.category] = b.count;
    for (const p of state.baseline?.places ?? []) if (removed.has(p.placeId)) counts[p.category] = Math.max(0, counts[p.category] - 1);
    const categories = CATEGORY_KEYS.map((k) => ({
      category: k,
      baselineCount: counts[k],
      importance: state.importance[k],
    }));
    const full = deriveRoutine(categories, state.anchor != null);
    const dropped = new Set(state.droppedRoutineNodes);
    const routine = full.filter((n) => n === 'home' || !dropped.has(n));
    return { places, counts, categories, routine };
  }, [state.baseline, state.removedPlaceIds, state.importance, state.anchor, state.droppedRoutineNodes]);

  const value = useMemo(() => ({ state, dispatch, derived }), [state, derived]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocus() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocus outside LocusProvider');
  return v;
}
