import { EVID, EVInfo, EVType, PointerID } from "./common";

export interface EditorContext<T, C> {
  /**
   * Config, which comes from the host or template
   */
  readonly config: C;

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
  readonly initRefVals: ReadonlyMap<EVID, EVInfo>;

  /**
   * The editor should call this to report that the EV that it's editing
   * has an updated value.
   */
  readonly valueChanged: (value: T) => void;

  /**
   * Add or remove a reference to another embedded value, e.g. one that was
   * dragged onto the editor.
   */
  readonly addRef: (evId: EVID) => void;
  readonly removeRef: (evId: EVID) => void;
}

export interface EditorReturn<T> {
  /**
   * A function to notify the editor that an EV it references has a new value.
   */
  readonly refChanged?: (evId: EVID, value: any) => void;

  /**
   * A function to tell the editor to clean up before it is removed from
   * the document. The editor need not remove its HTML from the container.
   */
  readonly cleanup?: () => void;
}

export interface Editor<T, C> {
  readonly create: (context: EditorContext<T, C>) => EditorReturn<T>;
}
