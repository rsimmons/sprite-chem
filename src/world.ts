import { Kind } from "./kind";
import { nextSeqNum } from "./util";
import { Vec2 } from "./vec";

export interface Object {
  id: number;
  kindId: number;
  pos: Vec2;
  size: number; // length of longest axis in world-space
}

export interface CommonWorldState {
  objects: Map<number, Object>; // TODO: convert to SoA?
}

export interface InitWorldState extends CommonWorldState {
}

export interface RunningWorldState extends CommonWorldState {
  worldTime: number;
}
