import { EVWrapper } from "../../extlib/ev";
import { Runner } from "../../extlib/runner";
import { EventStream, ProgramContext, VarContext, startProgram, stepProgram, stopProgram } from "../../extshared/codeExec";
import { createRenderCanvas, getWorldToCanvasXform, RenderableState, SpriteInstances } from "../../extshared/spriteWorld";
import { Vec2, applyInvSTXform, vec2add, vec2len, vec2scale, vec2sub } from "../../vec";
import { Sprite } from "../types/sprite";
import { SpriteWorldSetup } from "../types/spriteWorldSetup";

interface InstanceInfo {
  /**
   * Position of center
   */
  readonly pos: Vec2;

  /**
   * Length of longest axis (in world-space)
   */
  readonly size: number;

  // the program context includes any state for this instance
  readonly progContext: ProgramContext;
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

interface SharedNativeGlobalContext {
  readonly worldState: SpriteWorldState;

  // array of touch events that happened since last update
  readonly touchEvts: Array<{
    readonly pointerId: number;
    readonly pos: Vec2; // in world coords
  }>;
}

interface InstanceNativeGlobalContext {
  readonly instance: InstanceInfo;
}

/**
 * This is the global context for the execution of a single sprite-instance's
 * program, accessible to native (JS) code.
 */
let currentSharedNativeGlobalContext: SharedNativeGlobalContext = undefined!;
let currentInstanceNativeGlobalContext: InstanceNativeGlobalContext = undefined!;

function nearestInstPos(spriteEv: EVWrapper<Sprite>): (Vec2 | undefined) {
  let nearestPos: {x: number; y: number} | undefined = undefined;
  let nearestDistSq: number = Infinity;

  const state = currentSharedNativeGlobalContext.worldState;
  const inst = currentInstanceNativeGlobalContext.instance;

  const spriteInfo = state.sprites.get(spriteEv);
  if (spriteInfo) {
    for (const other of spriteInfo.instances) {
      const diff = vec2sub(other.pos, inst.pos);
      const distSq = vec2len(diff);
      if (distSq < nearestDistSq) {
        nearestPos = other.pos;
        nearestDistSq = distSq;
      }
    }
  }

  return nearestPos;
}

function instTouched(): EventStream<undefined> {
  const inst = currentInstanceNativeGlobalContext.instance;
  const touchEvts = currentSharedNativeGlobalContext.touchEvts;

  let touched = false;
  for (const touchEvt of touchEvts) {
    const diff = vec2sub(touchEvt.pos, inst.pos);
    const dist = vec2len(diff);
    if (dist <= inst.size) {
      touched = true;
      break;
    }
  }

  if (touched) {
    // return a single "unit" event
    return [undefined];
  } else {
    // return no events
    return undefined;
  }
}

const sharedNidVals: Map<string, any> = new Map<string, any>([
  ['origin', {x: 0, y: 0}],
  ['nearestInstPos', nearestInstPos],
  ['instTouched', instTouched],
]);

function advanceWorldState(worldState: SpriteWorldState, t: number, dt: number): SpriteWorldState {
  const newSprites = new Map<EVWrapper<Sprite>, SpriteInfo>();

  for (const [spriteEV, spriteInfo] of worldState.sprites) {
    const newInstances: Array<InstanceInfo> = [];

    for (const inst of spriteInfo.instances) {
      currentInstanceNativeGlobalContext = {
        instance: inst,
      };

      const varCtx: VarContext = {
        nidVal: new Map(sharedNidVals),
      };

      stepProgram(inst.progContext, varCtx);

      const moveTarget = varCtx.nidVal.get('moveTarget');
      const moveSpeed = varCtx.nidVal.get('moveSpeed') || 10;
      const removeInst = varCtx.nidVal.get('removeInst');
      if (removeInst) {
        continue;
      }

      let newPos: Vec2;
      if (moveTarget === undefined) {
        newPos = inst.pos;
      } else {
        const diff = vec2sub(moveTarget, inst.pos);
        const dist = vec2len(diff);
        const maxDist = moveSpeed*dt;
        if (dist <= maxDist) {
          newPos = moveTarget;
        } else {
          const move = vec2scale(diff, maxDist/dist);
          newPos = vec2add(inst.pos, move);
        }
      }

      const newInstanceInfo: InstanceInfo = {
        ...inst,
        pos: newPos,
      };
      newInstances.push(newInstanceInfo);
    }

    newSprites.set(spriteEV, {
      ...spriteInfo,
      instances: newInstances,
    });
  }

  return {
    sprites: newSprites,
  };
}

const spriteWorldRunner: Runner = {
  create: (context) => {
    context.container.innerHTML = `<div style="width: 100%; height: 100%">spriteWorldRunner</div>`;

    // TODO: init worldState from context
    const swsEv = context.singles.get('worldSetup')! as EVWrapper<SpriteWorldSetup>;
    const sws = swsEv.value;

    const accumTouchEvts: SharedNativeGlobalContext['touchEvts'] = [];

    context.container.addEventListener('pointerdown', (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const canvasPos = {x: pixelScale*(e.clientX - rect.left), y: pixelScale*(e.clientY - rect.top)};
      const worldCanvasXform = getWorldToCanvasXform(sws.viewport, canvas.width, canvas.height);
      const worldPos = applyInvSTXform(worldCanvasXform, canvasPos);

      accumTouchEvts.push({
        pointerId: e.pointerId,
        pos: worldPos,
      });
    });

    const sprites = new Map<EVWrapper<Sprite>, SpriteInfo>();

    for (const [spriteEv, insts] of sws.instances.entries()) {
      const sprite = spriteEv.value;

      const bitmap = sprite.imageBitmap;
      const invMaxDim = 1/Math.max(bitmap.width, bitmap.height);

      sprites.set(spriteEv, {
        bitmapInfo: {
          bitmap,
          scaledWidth: invMaxDim*bitmap.width,
          scaledHeight: invMaxDim*bitmap.height,
        },
        // copy pos, size and init program context
        instances: insts.map(inst => {
          const progContext = startProgram(sprite.code);

          const instanceInfo: InstanceInfo = {
            pos: {
              x: inst.pos.x,
              y: inst.pos.y,
            },
            size: inst.size,
            progContext,
          };

          return instanceInfo;
        }),
      });
    };

    let worldState: SpriteWorldState = {
      sprites,
    };

    const {cleanup: cleanupCanvas, canvas, pixelScale} = createRenderCanvas(context.container, (t: number, dt: number): RenderableState => {
      // this is getState callback

      currentSharedNativeGlobalContext = {
        touchEvts: accumTouchEvts,
        worldState,
      };

      worldState = advanceWorldState(worldState, t, dt);

      // clear per-update events
      accumTouchEvts.length = 0;

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
        viewport: sws.viewport,
      };
    });

    return {
      cleanup: () => {
        for (const [spriteEV, spriteInfo] of worldState.sprites) {
          for (const inst of spriteInfo.instances) {
            stopProgram(inst.progContext);
          }
        }

        cleanupCanvas();
      },
    };
  },
};

export default spriteWorldRunner;
