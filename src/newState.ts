import { TEMPLATE } from "./config";
import { PointerID } from "./extlib/editor";
import { EVWrapper } from "./extlib/ev";
import { arrRemoveElemByValue, arrReplaceElemByValue, genUidRandom, invariant } from "./util";
import { Vec2 } from "./vec";

export type DragState =
  {
    // has not yet "detached"
    readonly type: 'detachingEV';
    readonly dragId: string;
    readonly pointerId: PointerID;
    readonly ev: EVWrapper<any>;
    readonly pos: Vec2;
    readonly size: number;
    readonly offset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
    readonly startPos: Vec2;
  } | {
    readonly type: 'draggingEV';
    readonly dragId: string;
    readonly pointerId: PointerID;
    readonly ev: EVWrapper<any>;
    readonly pos: Vec2;
    readonly size: number;
    readonly offset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
  } | {
    readonly type: 'draggingValue';
    readonly dragId: string;
    readonly pointerId: PointerID;
    readonly typeId: string;
    readonly value: any;
    readonly pos: Vec2;
    readonly node: HTMLElement | undefined;
    readonly offset: Vec2; // in pixels relative to top left
  };

export interface AppState {
  readonly singles: ReadonlyMap<string, EVWrapper<any>>;
  readonly pools: ReadonlyMap<string, ReadonlyArray<EVWrapper<any>>>;

  readonly running: boolean;
  readonly dragStates: ReadonlyArray<DragState>;
}

export type AppStateOrLoading = AppState | 'loading';

export async function createInitState(): Promise<AppState> {
  const {singles, pools} = await TEMPLATE.initEVs();

  return {
    singles,
    pools,
    running: false,
    dragStates: [],
  };
}

export type AppAction =
  {
    readonly type: 'load';
    readonly state: AppState;
  } | {
    readonly type: 'toggleRunning';
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
    readonly ev: EVWrapper<any>;
    readonly pos: Vec2;
    readonly size: number;
    readonly offset: Vec2;
  } | {
    readonly type: 'pointerDownOnValue';
    readonly pointerId: PointerID;
    readonly typeId: string;
    readonly value: any;
    readonly pos: Vec2;
    readonly node: HTMLElement | undefined;
    readonly offset: Vec2;
  };

export type AppDispatch = React.Dispatch<AppAction>;

export function reducer(state: AppStateOrLoading, action: AppAction): AppStateOrLoading {
  if (state === 'loading') {
    if (action.type === 'load') {
      return action.state;
    } else {
      throw new Error('cannot dispatch other actions before loading');
    }
  }

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
              dragId: ds.dragId,
              pointerId: ds.pointerId,
              ev: ds.ev,
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

        case 'draggingValue': {
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
          dragId: genUidRandom(),
          pointerId: action.pointerId,
          ev: action.ev,
          pos: action.pos,
          size: action.size,
          offset: action.offset,
          startPos: action.pos,
        }]),
      };
    }

    case 'pointerDownOnValue': {
      return {
        ...state,
        dragStates: state.dragStates.concat([{
          type: 'draggingValue',
          dragId: genUidRandom(),
          pointerId: action.pointerId,
          typeId: action.typeId,
          value: action.value,
          pos: action.pos,
          node: action.node,
          offset: action.offset,
        }]),
      };
    }
  }

  throw new Error('should be unreachable');
}

