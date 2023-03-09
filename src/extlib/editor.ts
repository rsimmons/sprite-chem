import { EVID, EVType, PointerID } from "./common";

export interface EditorContext<T> {
  /**
   * The container element that the editor is to install itself into.
   * The container is expected to be a block container and to have
   * a definite size, i.e. the container determines the size of the editor.
   */
  readonly container: HTMLElement;

  /**
   * The initial underlying value this editor is editing
   */
  readonly initValue: T;

  /**
   * Initial values of any EVs the editor depends on
   */
  readonly initDepVals: ReadonlyMap<EVID, any>;

  /**
   * The editor should call this to report that the EV that it's editing
   * has an updated value.
   */
  readonly valueChanged: (value: T) => void;

  /**
   * Add or remove a dependency on an embedded value, e.g. one that was
   * dragged onto the editor.
   */
  readonly addDep: (id: EVID) => void;
  readonly removeDep: (id: EVID) => void;

  /**
   * Begin dragging an EV from the editor
   */
  readonly beginEVDrag: (id: EVID, event: MouseEvent|TouchEvent) => void;
}

export interface EditorReturn<T> {
  /**
   * A function to notify the editor that an EV it depends on has a new value.
   */
  readonly depChanged?: (id: EVID, value: any) => void;

  /**
   * These allow editor to receive EV drags
   */
  readonly checkEVDrag?: (type: EVType, id: EVID, curValue: any, event: MouseEvent|TouchEvent) => boolean;
  readonly endEVDrag?: (type: EVType, id: EVID, curValue: any, event: MouseEvent|TouchEvent) => void;

  /**
   * A function to tell the editor to clean up before it is removed from
   * the document. The editor need not remove its HTML from the container.
   */
  readonly cleanup?: () => void;
}

export interface Editor<T> {
  readonly create: (context: EditorContext<T>) => EditorReturn<T>;
}
