export type EVID = string;

export type EVType = string;

// these could be defined to narrow things a bit, like:
// - https://github.com/microsoft/TypeScript/issues/1897
// - https://dev.to/ankittanna/how-to-create-a-type-for-complex-json-object-in-typescript-d81
export type LoadedState = any;
export type SaveableState = any;

export interface LoaderSaver<T> {
  readonly load: (state: LoadedState) => T;
  readonly save: (val: T) => SaveableState;
}

export type PointerID = 'mouse' | number;

export type ExtensionID = string;

export interface EVInfo {
  readonly type: EVType;
  readonly value: any;
  readonly refs: ReadonlySet<EVID>; // other EVs this one contains references to
}

// attached to DOM events pointermove, pointerup
export interface AttachedDragData {
  readonly evId: EVID;
  readonly evInfo: EVInfo;
  readonly size: number;
  readonly offset: {x: number, y: number};
}
