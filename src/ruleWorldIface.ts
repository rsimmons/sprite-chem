import { getKindInitialSize } from "./rule";
import { invariant, nextSeqNum } from "./util";
import { Vec2 } from "./vec";
import { Object, RunningWorldState } from "./world";

type ObjHandle = Object;

export interface RuleWorldIface {
  readonly iterObjectsByKindId: (kindId: number) => Generator<ObjHandle>;
  readonly getObjectPosition: (obj: ObjHandle) => Vec2;
  readonly getObjectSize: (obj: ObjHandle) => number;
  readonly setObjectMoveTowardPosition: (obj: ObjHandle, pos: Vec2, speed: number) => void;
  readonly createObject: (kindId: number, pos: Vec2) => void;
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
        if (obj.kindId === kindId) {
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

    createObject: (kindId: number, pos: Vec2) => {
      const id = nextSeqNum();
      ws.objects.set(id, {
        id,
        kindId,
        pos,
        size: getKindInitialSize(kindId),
      });
    },

    removeObject: (obj: Object) => {
      eff.objsRemoved.add(obj.id);
    },
  };
}
