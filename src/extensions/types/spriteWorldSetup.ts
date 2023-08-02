import { EVWrapper } from "../../extlib/ev";
import { Viewport } from "../../extshared/spriteWorld";
import { Sprite } from "./sprite";

export interface SpriteInstance {
  /**
   * Position of center
   */
  readonly pos: {
    x: number;
    y: number;
  };

  /**
   * Length of longest axis (in world-space)
   */
  size: number;
}

export interface SpriteWorldSetup {
  /**
   * Map from the EVID of a Sprite to its instances
   */
  readonly instances: Map<EVWrapper<Sprite>, Array<SpriteInstance>>;

  readonly viewport: Viewport;
}
