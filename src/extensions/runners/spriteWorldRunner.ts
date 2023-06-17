import { EVWrapper } from "../../extlib/ev";
import { Runner } from "../../extlib/runner";
import { DynamicContext, interpretProg } from "../../extshared/codeExec";
import { createRenderCanvas, SpriteInstances } from "../../extshared/spriteWorld";
import { vec2add, vec2len, vec2scale, vec2sub } from "../../vec";
import { Sprite } from "../types/sprite";
import { SpriteWorldSetup } from "../types/spriteWorldSetup";

interface InstanceInfo {
  /**
   * Position of center
   */
  pos: {
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
   * Map from a Sprite EV to its instances
   */
  readonly sprites: Map<EVWrapper<Sprite>, SpriteInfo>;
}

function advanceWorldState(state: SpriteWorldState, t: number, dt: number): void {
  for (const [spriteEV, spriteInfo] of state.sprites) {
    const prog = spriteEV.value.code;
    for (const inst of spriteInfo.instances) {
      const dynCtx: DynamicContext = {
        nidVal: new Map([
          ['origin', {x: 0, y: 0}],
        ]),
      };

      interpretProg(prog, dynCtx);

      const moveTarget = dynCtx.nidVal.get('moveTarget');
      const moveSpeed = dynCtx.nidVal.get('moveSpeed') || 10;

      if (moveTarget) {
        const diff = vec2sub(moveTarget, inst.pos);
        const dist = vec2len(diff);
        const maxDist = moveSpeed*dt;
        if (dist <= maxDist) {
          inst.pos = moveTarget;
        } else {
          const move = vec2scale(diff, maxDist/dist);
          inst.pos = vec2add(inst.pos, move);
        }
      }
    }
  }
}

const spriteWorldRunner: Runner = {
  create: (context) => {
    context.container.innerHTML = `<div style="width: 100%; height: 100%">spriteWorldRunner</div>`;

    // TODO: init worldState from context
    const swsEv = context.singles.get('worldSetup')! as EVWrapper<SpriteWorldSetup>;
    const sws = swsEv.value;

    // worldState is undefined until bitmaps are loaded
    let worldState: SpriteWorldState | undefined;

    // deep clone and load bitmaps, async
    (async () => {
      const sprites = new Map<EVWrapper<Sprite>, SpriteInfo>();

      for (const [spriteEv, insts] of sws.instances.entries()) {
        const sprite = spriteEv.value;

        const bitmap = await createImageBitmap(sprite.imageBlob);
        const invMaxDim = 1/Math.max(bitmap.width, bitmap.height);

        sprites.set(spriteEv, {
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

    const {cleanup: cleanupCanvas, canvas, pixelScale} = createRenderCanvas(context.container, (t: number, dt: number) => {
      // this is getState callback
      if (worldState) {
        advanceWorldState(worldState, t, dt);

        const renderInsts: Map<EVWrapper<Sprite>, SpriteInstances> = new Map();
        worldState.sprites.forEach((spriteInfo, spriteEV) => {
          renderInsts.set(spriteEV, {
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
