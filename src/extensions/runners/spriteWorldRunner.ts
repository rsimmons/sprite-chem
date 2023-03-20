import { EVID } from "../../extlib/common";
import { Runner } from "../../extlib/runner";
import { createRenderCanvas, SpriteInstances } from "../../extshared/spriteWorld";
import { Sprite } from "../types/sprite";
import { SpriteWorldSetup } from "../types/spriteWorldSetup";

interface InstanceInfo {
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

interface SpriteInfo {
  readonly bitmapInfo: {
    readonly bitmap: ImageBitmap,
    // [0-1] relative to max dimension
    readonly scaledWidth: number;
    readonly scaledHeight: number;
  };
  readonly instances: ReadonlyArray<InstanceInfo>;
}

interface SpriteWorldState {
  /**
   * Map from the EVID of a Sprite to its instances
   */
  readonly sprites: Map<EVID, SpriteInfo>;
}

function advanceWorldState(state: SpriteWorldState): void {
  for (const [, sprite] of state.sprites) {
    for (const inst of sprite.instances) {
      inst.pos.x += 10*(Math.random() - 0.5);
      inst.pos.y += 10*(Math.random() - 0.5);
    }
  }
}

const spriteWorldRunner: Runner = {
  create: (context) => {
    context.container.innerHTML = `<div style="width: 100%; height: 100%">spriteWorldRunner</div>`;

    // TODO: init worldState from context
    const swsEvId = context.singles.get('worldSetup')!;
    const swsEv = context.evInfos.get(swsEvId)!;
    const sws = swsEv.value as SpriteWorldSetup;

    // worldState is undefined until bitmaps are loaded
    let worldState: SpriteWorldState | undefined;

    // deep clone and load bitmaps, async
    (async () => {
      const sprites = new Map<EVID, SpriteInfo>();

      for (const [spriteEvId, insts] of sws.instances.entries()) {
        const spriteEv = context.evInfos.get(spriteEvId)!;
        const sprite = spriteEv.value as Sprite;

        const bitmap = await createImageBitmap(sprite.imageBlob);
        const invMaxDim = 1/Math.max(bitmap.width, bitmap.height);

        sprites.set(spriteEvId, {
          bitmapInfo: {
            bitmap,
            scaledWidth: invMaxDim*bitmap.width,
            scaledHeight: invMaxDim*bitmap.height,
          },
          // deep clone
          instances: insts.map(inst => ({
            pos: {
              x: inst.pos.x,
              y: inst.pos.y,
            },
            size: inst.size,
          })),
        });
      };

      worldState = {
        sprites,
      };
    })();

    const {cleanup: cleanupCanvas, canvas, pixelScale} = createRenderCanvas(context.container, () => {
      // this is getState callback
      if (worldState) {
        advanceWorldState(worldState);

        const renderInsts: Map<string, SpriteInstances> = new Map();
        worldState.sprites.forEach((spriteInfo, evId) => {
          renderInsts.set(evId, {
            bitmap: spriteInfo.bitmapInfo.bitmap,
            scaledWidth: spriteInfo.bitmapInfo.scaledWidth,
            scaledHeight: spriteInfo.bitmapInfo.scaledHeight,
            instances: spriteInfo.instances,
          });
        });
        return {
          instances: renderInsts,
        };
      } else {
        // perhaps we should return some sort of "loading" flag
        return {
          instances: new Map(),
        };
      }
    });

    return {
      cleanup: () => {
        cleanupCanvas();
      },
    };
  },
};

export default spriteWorldRunner;
