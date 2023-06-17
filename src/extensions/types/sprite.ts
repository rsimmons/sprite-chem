import { Code } from "./code";

export interface Sprite {
  readonly imageBlob: Blob;
  readonly code: Code;
}
