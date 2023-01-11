import { Vec2 } from "./vec";
import { Object, WorldState } from "./world";

type ObjHandle = Object;

export interface RuleWorldIface {
  readonly iterObjectsByKindId: (kindId: number) => Generator<ObjHandle>;
  readonly getObjectPosition: (obj: ObjHandle) => Vec2;
  readonly setObjectMoveTowardPosition: (obj: ObjHandle, pos: Vec2, speed: number) => void;
}

class RuleWorldAdapter implements RuleWorldIface {
  private ws: WorldState;

  constructor(ws: WorldState) {
    this.ws = ws;
  }

  *iterObjectsByKindId(kindId: number) {
    for (const obj of this.ws.objects.values()) {
      if (obj.kind.id === kindId) {
        yield obj;
      }
    }
  }

  getObjectPosition(obj: Object) {
    return obj.pos;
  }

  setObjectMoveTowardPosition(obj: Object, pos: Vec2, speed: number) {
    throw new Error('unimplemented');
  }
}

export function createAdapter(ws: WorldState) {
  return new RuleWorldAdapter(ws);
}
