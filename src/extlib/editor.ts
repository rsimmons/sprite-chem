import { EVWrapper } from "./ev";

export type PointerID = 'mouse' | number;

// attached to DOM events pointermove, pointerup
export interface EVDragInfo {
  readonly ev: EVWrapper<any>
  readonly size: number;
  readonly offset: {x: number, y: number};
}

export interface ValueDragInfo {
  readonly typeId: string;
  readonly value: any;
  readonly offset: {x: number, y: number};
}

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
   * The EV this editor is editing
   */
  readonly ev: EVWrapper<T>;

  /**
   * Begin a drag of a value/object that is NOT an EV.
   */
  readonly beginDrag: (
    typeId: string,
    pointerId: PointerID,
    value: any,
    pos: {x: number, y: number},
    node: HTMLElement | undefined,
    offset: {x: number, y: number},
    // TODO: optional callback(s) to get notified of drag end, etc.
  ) => void;
}

export interface EditorReturn<T> {
  /**
   * A function to tell the editor to clean up before it is removed from
   * the document. The editor need not remove its HTML from the container.
   */
  readonly cleanup?: () => void;
}

export interface Editor<T, C> {
  readonly create: (context: EditorContext<T, C>) => EditorReturn<T>;
}
