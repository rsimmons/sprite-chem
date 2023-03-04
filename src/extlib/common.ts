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
