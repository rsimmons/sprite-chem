import { EVWrapper } from "./ev";
import { Previewer } from "./previewer";
import { EVTypeId } from "./type";

export type PointerID = 'mouse' | number;

export type DragPayload =
  {
    readonly type: 'ev';
    readonly ev: EVWrapper<any>;
  } | {
    readonly type: 'value';
    readonly typeId: string;
    readonly value: any;
  };

export interface PointerEventData {
  pointerId: PointerID;
  pos: {x: number, y: number};
  dragInfo: DragInfo | undefined;
}

export interface DragInfo {
  readonly dragId: string; // stable unique ID for this drag
  readonly payload: DragPayload;
  readonly width: number;
  readonly height: number;
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
   * The value this editor is editing (NOT wrapped as an EV)
   */
  readonly initialValue: T;

  /**
   * The editor should call this to report that the value that it's editing
   * has an updated value.
   */
  readonly valueChanged: (newValue: T) => void;

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

  // events fired are 'pointerMove' and 'pointerUp',
  // and details are of type PointerEventData
  readonly pointerEventTarget: EventTarget;

  /**
   * Get an EV previewer for a given type ID (if one exists)
   */
  readonly getPreviewer: (typeId: EVTypeId) => Previewer<any> | undefined;
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
