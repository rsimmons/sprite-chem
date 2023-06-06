import { EVWrapper } from "../../extlib/ev";
import { Sprite } from "./sprite";

interface SpriteInstance {
  /**
   * Position of center
   */
  readonly pos: {
    readonly x: number;
    readonly y: number;
  };

  /**
   * Length of longest axis (in world-space)
   */
  readonly size: number;
}

export interface SpriteWorldSetup {
  /**
   * Map from the EVID of a Sprite to its instances
   */
  readonly instances: ReadonlyMap<EVWrapper<Sprite>, ReadonlyArray<SpriteInstance>>;
}
