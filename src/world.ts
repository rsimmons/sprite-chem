import { Kind } from "./kind";
import { Vec2 } from "./vec";

export interface Object {
  id: number;
  kind: Kind;
  pos: Vec2;
  size: number; // length of longest axis in world-space
}

export interface WorldState {
  worldTime: number;
  nextObjectId: number;
  objects: Map<number, Object>; // TODO: convert to SoA?
}

export function addObject(ws: WorldState, kind: Kind, pos: Vec2, size: number): void {
  const oid = ws.nextObjectId;
  ws.objects.set(oid, {
    id: oid,
    kind,
    pos,
    size,
  });
  ws.nextObjectId++;
}

export function removeObject(ws: WorldState, objId: number): void {
  ws.objects.delete(objId);
}
