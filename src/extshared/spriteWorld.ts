import { EVWrapper } from "../extlib/ev";
import { Sprite } from "../extensions/types/sprite";
import { invariant } from "../util";
import { STXform, Vec2, applySTXform } from "../vec";

export interface SpriteInstances {
  readonly bitmap: ImageBitmap;

  // [0-1] relative to max dimension
  readonly scaledWidth: number;
  readonly scaledHeight: number;

  readonly instances: ReadonlyArray<{
    readonly pos: Vec2; // center of sprite
    readonly size: number; // length of longest axis in world-space
  }>;
}

export interface RenderableState {
  readonly instances: ReadonlyMap<EVWrapper<Sprite>, SpriteInstances>;
  readonly viewport: Viewport;
}

// the viewport is a square with the given center and size (side length) in world coords
export interface Viewport {
  readonly center: Vec2;
  readonly size: number;
}

export function getWorldToCanvasXform(viewport: Viewport, canvasWidth: number, canvasHeight: number): STXform {
  const invSize = 1/viewport.size;
  const minDim = Math.min(canvasWidth, canvasHeight);
  return {
    s: minDim*invSize,
    tx: canvasWidth*(0.5 - viewport.center.x*invSize),
    ty: canvasHeight*(0.5 + viewport.center.y*invSize),
  };
}

export interface CreateRenderCanvasReturn {
  readonly cleanup: () => void;
  readonly canvas: HTMLCanvasElement;
  readonly pixelScale: number;
}

export function createRenderCanvas(container: HTMLElement, getState: (t: number, dt: number) => RenderableState): CreateRenderCanvasReturn {
  const USE_HIDPI = true;
  const pixelScale = USE_HIDPI ? window.devicePixelRatio : 1;

  const sizeCanvas = (): {canvasWidth: number; canvasHeight: number} => {
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const canvasWidth = pixelScale*containerWidth;
    const canvasHeight = pixelScale*containerHeight;

    // only do resize if necessary
    if ((canvas.width !== canvasWidth) || (canvas.height !== canvasHeight)) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;
    }

    return {
      canvasWidth,
      canvasHeight,
    };
  };

  const render = (canvasWidth: number, canvasHeight: number, t: number, dt: number): void => {
    const ctx = canvas.getContext('2d');
    invariant(ctx);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const state = getState(t, dt);

    const worldCanvasXform = getWorldToCanvasXform(state.viewport, canvasWidth, canvasHeight);

    state.instances.forEach((insts, spriteEV) => {
      for (const inst of insts.instances) {
        const width = inst.size*insts.scaledWidth;
        const height = inst.size*insts.scaledHeight;
        const worldTopLeft = {x: inst.pos.x - 0.5*width, y: inst.pos.y - 0.5*height};
        // TODO: I think we could use the builtin canvas transform here instead of doing the math ourselves
        const canvasTopLeft = applySTXform(worldCanvasXform, worldTopLeft);
        ctx.drawImage(insts.bitmap, canvasTopLeft.x, canvasTopLeft.y, worldCanvasXform.s*width, worldCanvasXform.s*height);
      }
    });

    ctx.fillStyle = '#000000';
    if (canvasHeight > canvasWidth) {
      const barSize = 0.5*(canvasHeight - canvasWidth);
      ctx.fillRect(0, 0, canvasWidth, barSize);
      ctx.fillRect(0, canvasHeight - barSize, canvasWidth, barSize);
    } else if (canvasWidth > canvasHeight) {
      const barSize = 0.5*(canvasWidth - canvasHeight);
      ctx.fillRect(0, 0, barSize, canvasHeight);
      ctx.fillRect(canvasWidth - barSize, 0, barSize, canvasHeight);
    }

    // sanity check that we have canvas dims correct
    ctx.fillRect(canvasWidth-15, canvasHeight-15, 10, 10);
  };

  const frameCallback = (time: number): void => {
    let deltaTime = 0;
    if (prevTime !== undefined) {
      deltaTime = time - prevTime;
    }
    prevTime = time;

    const {canvasWidth, canvasHeight} = sizeCanvas();
    render(canvasWidth, canvasHeight, 0.001*time, 0.001*deltaTime);

    rafId = requestAnimationFrame(frameCallback);
  };

  const canvas = document.createElement('CANVAS') as HTMLCanvasElement;
  container.replaceChildren(canvas);

  let rafId = requestAnimationFrame(frameCallback);
  let prevTime: number | undefined = undefined;

  return {
    cleanup: () => {
      cancelAnimationFrame(rafId);
    },
    canvas,
    pixelScale,
  };
}
