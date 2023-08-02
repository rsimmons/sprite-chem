import { TEMPLATE } from "./config";
import { PointerID } from "./extlib/editor";
import { EVWrapper } from "./extlib/ev";
import { arrRemoveElemByValue, arrReplaceElemByValue, genUidRandom, invariant } from "./util";
import { Vec2 } from "./vec";

interface DragState {
  readonly dragId: string;
  readonly pointerId: PointerID;
  readonly pos: Vec2; // pointer position
  readonly offset: Vec2; // subtract this from pos to get the top-left corner of the preview
  readonly dims: Vec2; // dimensions of the preview
  readonly payload:
    {
      readonly type: 'ev';
      readonly ev: EVWrapper<any>;
    } | {
      readonly type: 'value';
      readonly typeId: string;
      readonly value: any;
      readonly previewElem: HTMLElement;
    };
}

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
    readonly type: 'beginDragEV';
    readonly pointerId: PointerID;
    readonly ev: EVWrapper<any>;
    readonly pos: Vec2;
    readonly offset: Vec2;
    readonly size: number; // width and height of preview
  } | {
    readonly type: 'beginDragValue';
    readonly pointerId: PointerID;
    readonly typeId: string;
    readonly value: any;
    readonly pos: Vec2;
    readonly offset: Vec2;
    readonly dims: Vec2;
    readonly previewElem: HTMLElement;
  } | {
    readonly type: 'pointerMove';
    readonly pointerId: PointerID;
    readonly pos: Vec2;
  } | {
    readonly type: 'pointerUp';
    readonly pointerId: PointerID;
    readonly pos: Vec2;
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

    case 'beginDragEV': {
      return {
        ...state,
        dragStates: state.dragStates.concat([{
          dragId: genUidRandom(),
          pointerId: action.pointerId,
          pos: action.pos,
          offset: action.offset,
          dims: {x: action.size, y: action.size},
          payload: {
            type: 'ev',
            ev: action.ev,
          },
        }]),
      };
    }

    case 'beginDragValue': {
      return {
        ...state,
        dragStates: state.dragStates.concat([{
          dragId: genUidRandom(),
          pointerId: action.pointerId,
          pos: action.pos,
          offset: action.offset,
          dims: action.dims,
          payload: {
            type: 'value',
            typeId: action.typeId,
            value: action.value,
            previewElem: action.previewElem,
          },
        }]),
      };
    }

    case 'pointerMove': {
      const ds = findMatchingDragState(action.pointerId);
      if (!ds) {
        return state;
      }

      const newDs: DragState = {
        ...ds,
        pos: action.pos,
      };

      return {
        ...state,
        dragStates: arrReplaceElemByValue(state.dragStates, ds, newDs),
      };
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
  }

  throw new Error('should be unreachable');
}

