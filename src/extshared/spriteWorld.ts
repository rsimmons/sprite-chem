import { invariant } from "../util";
import { Vec2 } from "../vec";

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
  instances: ReadonlyMap<string, SpriteInstances>;
}

interface CreateRenderCanvasReturn {
  readonly cleanup: () => void;
  readonly canvas: HTMLElement;
  readonly pixelScale: number;
}

export function createRenderCanvas(container: HTMLElement, getState: () => RenderableState): CreateRenderCanvasReturn {
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

  const render = (canvasWidth: number, canvasHeight: number, dt: number): void => {
    const ctx = canvas.getContext('2d');
    invariant(ctx);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const state = getState();
    state.instances.forEach((insts, spriteId) => {
      for (const inst of insts.instances) {
        const width = inst.size*insts.scaledWidth;
        const height = inst.size*insts.scaledHeight;
        const left = inst.pos.x - 0.5*width;
        const top = inst.pos.y - 0.5*height;
        ctx.drawImage(insts.bitmap, left, top, width, height);
      }
    });

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
    render(canvasWidth, canvasHeight, 0.001*deltaTime);

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
