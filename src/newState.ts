import { TEMPLATE } from "./config";
import { Sprite } from "./extensions/types/sprite";
import { EVID, EVInfo, EVType, PointerID } from "./extlib/common";
import { Creator } from "./extlib/creator";
import { arrRemoveElemByValue, arrReplaceElemByValue, genUidRandom, invariant } from "./util";
import { Vec2 } from "./vec";

export type DragState =
  {
    // has not yet "detached"
    readonly type: 'detachingEV';
    readonly pointerId: PointerID;
    readonly evId: EVID;
    readonly pos: Vec2;
    readonly size: number;
    readonly offset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
    readonly startPos: Vec2;
  } | {
    readonly type: 'draggingEV';
    readonly pointerId: PointerID;
    readonly evId: EVID;
    readonly pos: Vec2;
    readonly size: number;
    readonly offset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
  };

export interface AppState {
  readonly evs: ReadonlyMap<EVID, {
    readonly type: EVType;
    readonly value: any;
    readonly refs: ReadonlySet<EVID>; // other EVs this one contains references to
  }>;
  readonly singles: ReadonlyMap<string, EVID>;
  readonly pools: ReadonlyMap<string, ReadonlyArray<EVID>>;

  readonly running: boolean;
  readonly dragStates: ReadonlyArray<DragState>;
}

const stoppedEditorType = TEMPLATE.outputPanel.stoppedEditor.type;
const stoppedEditorInitValCreator= TEMPLATE.creators[stoppedEditorType]![0] as Creator<any, void>;
invariant(stoppedEditorInitValCreator);
const stoppedEditorEVId = genUidRandom();
const stoppedEditorInitVal = stoppedEditorInitValCreator.create();

export const INIT_STATE: AppState = {
  evs: new Map([
    [stoppedEditorEVId, {
      type: stoppedEditorType,
      value: stoppedEditorInitVal,
      refs: new Set(),
    }],
  ]),
  singles: new Map([
    [TEMPLATE.outputPanel.stoppedEditor.globalId, stoppedEditorEVId],
  ]),
  pools: new Map([
    ['sprites', []],
  ]),

  running: false,
  dragStates: [],
};

export type AppAction =
  {
    readonly type: 'toggleRunning';
  } | {
    // just for debugging
    readonly type: 'addSprite';
    readonly blob: Blob;
  } | {
    readonly type: 'pointerMove';
    readonly pointerId: PointerID;
    readonly pos: Vec2;
  } | {
    readonly type: 'pointerUp';
    readonly pointerId: PointerID;
    readonly pos: Vec2;
  } | {
    readonly type: 'pointerDownOnEV';
    readonly pointerId: PointerID;
    readonly evId: EVID;
    readonly pos: Vec2;
    readonly size: number;
    readonly offset: Vec2;
  } | {
    readonly type: 'evUpdate';
    readonly evId: EVID;
    readonly val: any;
  } | {
    readonly type: 'evAddRef';
    readonly evId: EVID;
    readonly refId: EVID;
  } | {
    readonly type: 'evRemoveRef';
    readonly evId: EVID;
    readonly refId: EVID;
  };

export type AppDispatch = React.Dispatch<AppAction>;

export function getEvTransitiveRefInfos(state: AppState, evIds: ReadonlyArray<EVID>): Map<EVID, EVInfo> {
  // NOTE: We do not deal with graph cycles, and diamonds are inefficient in that we redo work

  const helper = (ei: EVID): ReadonlyArray<[EVID, EVInfo]> => {
    const ev = state.evs.get(ei);
    invariant(ev);
    return [...ev.refs].flatMap(refId => {
      const refEv = state.evs.get(refId);
      invariant(refEv);
      return helper(refId);
    }).concat([[ei, ev]]);
  };

  return new Map(evIds.flatMap(helper));
}

export function reducer(state: AppState, action: AppAction): AppState {
  const findMatchingDragState = (pointerId: PointerID): DragState | undefined => {
    const matchDragStates = state.dragStates.filter(s => (s.pointerId === pointerId));
    if (matchDragStates.length === 1) {
      return matchDragStates[0];
    } else {
      invariant(matchDragStates.length === 0);
      return undefined;
    }
  };

  switch (action.type) {
    case 'addSprite': {
      const value: Sprite = {
        imageBlob: action.blob,
      };

      const evid = genUidRandom();
      const newEvs = new Map(state.evs);
      newEvs.set(evid, {
        type: 'sprite',
        value,
        refs: new Set(),
      });

      const newPools = new Map(state.pools);
      const poolEVIds = newPools.get('sprites');
      invariant(poolEVIds);
      const newPoolEVIds = [...poolEVIds];
      newPoolEVIds.push(evid);
      newPools.set('sprites', newPoolEVIds);

      return {
        ...state,
        evs: newEvs,
        pools: newPools,
      };
    }

    case 'toggleRunning': {
      return {
        ...state,
        running: !state.running,
      };
    }

    case 'pointerMove': {
      const ds = findMatchingDragState(action.pointerId);
      if (!ds) {
        return state;
      }

      switch (ds.type) {
        case 'detachingEV': {
          const newDs: DragState = ((action.pos.x - ds.startPos.x) > 15) ?
            {
              type: 'draggingEV',
              pointerId: ds.pointerId,
              evId: ds.evId,
              pos: ds.pos,
              size: ds.size,
              offset: ds.offset,
            } : {
              ...ds,
              pos: action.pos,
            };

          return {
            ...state,
            dragStates: arrReplaceElemByValue(state.dragStates, ds, newDs),
          };
        }

        case 'draggingEV': {
          const newDs: DragState = {
            ...ds,
            pos: action.pos,
          };

          return {
            ...state,
            dragStates: arrReplaceElemByValue(state.dragStates, ds, newDs),
          };
        }
      }

      throw new Error('should be unreachable');
    }

    case 'pointerUp': {
      const ds = findMatchingDragState(action.pointerId);
      if (!ds) {
        return state;
      }

      return {
        ...state,
        dragStates: arrRemoveElemByValue(state.dragStates, ds),
      };
    }

    case 'pointerDownOnEV': {
      return {
        ...state,
        dragStates: state.dragStates.concat([{
          type: 'detachingEV',
          pointerId: action.pointerId,
          evId: action.evId,
          pos: action.pos,
          size: action.size,
          offset: action.offset,
          startPos: action.pos,
        }]),
      };
    }

    case 'evUpdate': {
      const newEvs = new Map(state.evs);
      const prev = newEvs.get(action.evId);
      invariant(prev);
      newEvs.set(action.evId, {
        ...prev,
        value: action.val,
      });

      return {
        ...state,
        evs: newEvs,
      };
    }

    case 'evAddRef': {
      const newEvs = new Map(state.evs);
      const prev = newEvs.get(action.evId);
      invariant(prev);
      const newRefs = new Set(prev.refs);
      newRefs.add(action.refId);
      newEvs.set(action.evId, {
        ...prev,
        refs: newRefs,
      });

      return {
        ...state,
        evs: newEvs,
      };
    }

    case 'evRemoveRef': {
      const newEvs = new Map(state.evs);
      const prev = newEvs.get(action.evId);
      invariant(prev);
      const newRefs = new Set(prev.refs);
      invariant(newRefs.has(action.refId));
      newRefs.delete(action.refId);
      newEvs.set(action.evId, {
        ...prev,
        refs: newRefs,
      });

      return {
        ...state,
        evs: newEvs,
      };
    }
  }
}

