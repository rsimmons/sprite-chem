import { Sprite } from '../types/sprite';
import { Previewer } from '../../extlib/previewer';

const spritePreviewer: Previewer<Sprite> = {
  create: (context) => {
    const container = context.container;
    container.innerHTML = '<canvas style="width: 100%; height: 100%; display: block" />';
    const canvas = container.querySelector('canvas')!;

    const sizeCanvas = (): void => {
      const USE_HIDPI = true;
      const pixelScale = USE_HIDPI ? window.devicePixelRatio : 1;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const canvasWidth = pixelScale*containerWidth;
      const canvasHeight = pixelScale*containerHeight;

      // only do resize if necessary
      if ((canvas.width !== canvasWidth) || (canvas.height !== canvasHeight)) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }
    }

    const updateImage = (): void => {
      const ctx = canvas.getContext('2d')!;

      const bitmap = context.ev.value.imageBitmap;

      const wScale = canvas.width/bitmap.width;
      const hScale = canvas.height/bitmap.height;

      const scale = Math.min(wScale, hScale);

      const sWidth = scale*bitmap.width;
      const sHeight = scale*bitmap.height;

      const xOff = 0.5*(canvas.width - sWidth);
      const yOff = 0.5*(canvas.height - sHeight);

      ctx.drawImage(bitmap, xOff, yOff, sWidth, sHeight);
    }

    sizeCanvas();
    updateImage();

    // TODO: subscribe to ev changes

    return {};
  },
};

export default spritePreviewer;
