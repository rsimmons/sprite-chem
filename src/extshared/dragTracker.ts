type Pos = {x: number, y: number};

export interface DragInfo<T> {
  startPos: Pos;
  lastPos: Pos;
  pos: Pos;
  obj: T;
}

// type parameter is the type of the "object" being dragged
export class DragTracker<T> {
  private dragInfo: Map<number, DragInfo<T>> = new Map();

  constructor() {
  }

  public pointerDown(e: PointerEvent, obj: T): void {
    const pos = {x: e.clientX, y: e.clientY};
    this.dragInfo.set(e.pointerId, {
      startPos: pos,
      lastPos: pos,
      pos,
      obj,
    });
  }

  public pointerMove(e: PointerEvent): DragInfo<T> | undefined {
    const di = this.dragInfo.get(e.pointerId);
    if (di) {
      di.lastPos = di.pos;
      di.pos = {x: e.clientX, y: e.clientY};
      return di;
    } else {
      return undefined;
    }
  }

  public pointerUp(e: PointerEvent): DragInfo<T> | undefined {
    const di = this.dragInfo.get(e.pointerId);
    if (di) {
      this.dragInfo.delete(e.pointerId);
      return di;
    } else {
      return undefined;
    }
  }

  public stopTracking(pointerId: number): void {
    this.dragInfo.delete(pointerId);
  }
}
