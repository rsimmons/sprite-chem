import { EVID, LoaderSaver } from "../../extlib/common";

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
  readonly instances: ReadonlyMap<EVID, ReadonlyArray<SpriteInstance>>;
}

export const loaderSaver: LoaderSaver<SpriteWorldSetup> = {
  load: (state) => { throw new Error('unimplemented'); },
  save: (val) => { throw new Error('unimplemented'); },
}
