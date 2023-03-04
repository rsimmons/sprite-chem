import { Sprite } from "./extensions/types/sprite";
import { EVID, EVType, PointerID } from "./extlib/common";
import { arrRemoveElemByValue, arrReplaceElemByValue, genUidRandom, invariant } from "./util";
import { Vec2 } from "./vec";

type DragState =
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

interface AppState {
  readonly running: boolean;
  readonly evs: ReadonlyMap<EVID, {
    readonly type: EVType;
    readonly val: any;
  }>;
  readonly pools: ReadonlyMap<string, ReadonlyArray<EVID>>;
  readonly dragStates: ReadonlyArray<DragState>;
}

export const INIT_STATE: AppState = {
  running: false,
  evs: new Map(),
  pools: new Map([
    ['sprites', []],
  ]),
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
    readonly type: 'pointerEnd';
    readonly pointerId: PointerID;
    readonly pos: Vec2;
  } | {
    readonly type: 'pointerStartOnEV';
    readonly pointerId: PointerID;
    readonly evId: EVID;
    readonly pos: Vec2;
    readonly size: number;
    readonly offset: Vec2;
  };

export type AppDispatch = React.Dispatch<AppAction>;

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
      const val: Sprite = {
        imageBlob: action.blob,
      };

      const evid = genUidRandom();
      const newEvs = new Map(state.evs);
      newEvs.set(evid, {
        type: 'sprite',
        val,
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

    case 'toggleRunning':
      return state;

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

    case 'pointerEnd': {
      const ds = findMatchingDragState(action.pointerId);
      if (!ds) {
        return state;
      }

      return {
        ...state,
        dragStates: arrRemoveElemByValue(state.dragStates, ds),
      };
    }

    case 'pointerStartOnEV': {
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
  }
}

