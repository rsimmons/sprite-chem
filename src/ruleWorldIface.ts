import { invariant } from "./util";
import { Vec2 } from "./vec";
import { Object, RunningWorldState } from "./world";

type ObjHandle = Object;

export interface RuleWorldIface {
  readonly iterObjectsByKindId: (kindId: number) => Generator<ObjHandle>;
  readonly getObjectPosition: (obj: ObjHandle) => Vec2;
  readonly setObjectMoveTowardPosition: (obj: ObjHandle, pos: Vec2, speed: number) => void;
}

type ObjMoveEffect =
  {
    readonly type: 'towardPos';
    readonly pos: Vec2;
    readonly speed: number;
  };

export interface RuleWorldEffects {
  readonly objMoveEffs: Map<number, ObjMoveEffect>;
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

    setObjectMoveTowardPosition: (obj: Object, pos: Vec2, speed: number) => {
      invariant(!eff.objMoveEffs.has(obj.id));
      eff.objMoveEffs.set(obj.id, {
        type: 'towardPos',
        pos,
        speed,
      });
    },
  };
}
