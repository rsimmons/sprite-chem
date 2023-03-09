import { invariant } from "../util";
import { Vec2 } from "../vec";

export interface Instance {
  id: number;
  spriteId: number;
  pos: Vec2;
  size: number; // length of longest axis in world-space
}

export interface RenderableState {
  instances: Map<number, Instance>; // TODO: convert to SoA?
}

export function createRenderCanvas(container: HTMLElement, getState: () => RenderableState): () => void {
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

  return () => {
    cancelAnimationFrame(rafId);
  };
}
