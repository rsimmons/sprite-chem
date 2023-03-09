import { EVID, EVType } from "./extlib/common";

// attached to a DOM event or touch object
export interface AttachedDragData {
  readonly type: EVType;
  readonly evId: EVID;
}
