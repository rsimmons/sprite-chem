import { invariant } from "./util";
import { Vec2 } from "./vec";
import { Object, RunningWorldState } from "./world";

type ObjHandle = Object;

export interface RuleWorldIface {
  readonly iterObjectsByKindId: (kindId: number) => Generator<ObjHandle>;
  readonly getObjectPosition: (obj: ObjHandle) => Vec2;
  readonly getObjectSize: (obj: ObjHandle) => number;
  readonly setObjectMoveTowardPosition: (obj: ObjHandle, pos: Vec2, speed: number) => void;
  readonly removeObject: (obj: ObjHandle) => void;
}

type ObjMoveEffect =
  {
    readonly type: 'towardPos';
    readonly pos: Vec2;
    readonly speed: number;
  };

export interface RuleWorldEffects {
  readonly objMoveEffs: Map<number, ObjMoveEffect>;
  readonly objsRemoved: Set<number>;
}

export function createWorldIface(ws: RunningWorldState, eff: RuleWorldEffects): RuleWorldIface {
  return {
    iterObjectsByKindId: function*(kindId: number) { // no generator arrow fns!
      for (const obj of ws.objects.values()) {
        if (obj.kind.id === kindId) {
          yield obj;
        }
      }
    },

    getObjectPosition: (obj: Object) => {
      return obj.pos;
    },

    getObjectSize: (obj: Object) => {
      return obj.size;
    },

    setObjectMoveTowardPosition: (obj: Object, pos: Vec2, speed: number) => {
      invariant(!eff.objMoveEffs.has(obj.id));
      eff.objMoveEffs.set(obj.id, {
        type: 'towardPos',
        pos,
        speed,
      });
    },

    removeObject: (obj: Object) => {
      eff.objsRemoved.add(obj.id);
    }
  };
}
