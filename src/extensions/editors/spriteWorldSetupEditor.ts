import { Sprite } from '../types/sprite';
import { Editor, AttachedDragData } from '../../extlib/editor';
import { SpriteWorldSetup } from '../types/spriteWorldSetup';
import { createRenderCanvas, SpriteInstances } from '../../extshared/spriteWorld';
import { invariant } from '../../util';
import { EVWrapper } from '../../extlib/ev';

const spriteWorldSetupEditor: Editor<SpriteWorldSetup, undefined> = {
  create: (context) => {
    const ev = context.ev;

    interface CachedSpriteInfo {
      readonly sprite: Sprite;
      bitmapInfo: {
        readonly bitmap: ImageBitmap,
        // [0-1] relative to max dimension
        readonly scaledWidth: number;
        readonly scaledHeight: number;
      } | undefined;
    }
    const cachedSpriteInfo = new Map<EVWrapper<Sprite>, CachedSpriteInfo>();

    const loadBitmap = (info: CachedSpriteInfo) => {
      (async () => {
        const bitmap = await createImageBitmap(info.sprite.imageBlob);
        const invMaxDim = 1/Math.max(bitmap.width, bitmap.height);
        info.bitmapInfo = {
          bitmap,
          scaledWidth: invMaxDim*bitmap.width,
          scaledHeight: invMaxDim*bitmap.height,
        };
      })();
    };

    // handle dependencies of initial value
    ev.value.instances.forEach((insts, spriteEV) => {
      const info: CachedSpriteInfo = {
        sprite: spriteEV.value,
        bitmapInfo: undefined,
      };
      cachedSpriteInfo.set(spriteEV, info);
      loadBitmap(info);
    });

    const {cleanup, canvas, pixelScale} = createRenderCanvas(context.container, () => {
      // this is getState callback
      const renderInsts: Map<EVWrapper<Sprite>, SpriteInstances> = new Map();
      ev.value.instances.forEach((insts, spriteEV) => {
        const info = cachedSpriteInfo.get(spriteEV);
        invariant(info);
        if (info.bitmapInfo) {
          const bi = info.bitmapInfo;
          renderInsts.set(spriteEV, {
            bitmap: bi.bitmap,
            scaledWidth: bi.scaledWidth,
            scaledHeight: bi.scaledHeight,
            instances: insts,
          });
        }
      });
      return {
        instances: renderInsts,
      };
    });

    const getEventDragData = (e: PointerEvent): AttachedDragData | undefined => {
      return (e as any).draggingEV as (AttachedDragData | undefined);
    }

    const handlePointerUp = (e: PointerEvent) => {
      const dragData = getEventDragData(e);
      if (dragData) {
        if (dragData.ev.typeId === 'sprite') {
          const newInstances = new Map(ev.value.instances);
          if (!newInstances.has(dragData.ev)) {
            newInstances.set(dragData.ev, []);
            const info: CachedSpriteInfo = {
              sprite: dragData.ev.value as Sprite,
              bitmapInfo: undefined,
            };
            cachedSpriteInfo.set(dragData.ev, info);
            loadBitmap(info);
          }

          const rect = canvas.getBoundingClientRect();
          newInstances.set(dragData.ev, newInstances.get(dragData.ev)!.concat([{
            // NOTE: position we create is for center of sprite, but in dragData
            // position is for top-left corner of containing square
            pos: {
              x: pixelScale*(e.clientX - rect.left + dragData.size*(0.5 - dragData.offset.x)),
              y: pixelScale*(e.clientY - rect.top + dragData.size*(0.5 - dragData.offset.y)),
            },
            size: pixelScale*dragData.size,
          }]));

          ev.value = {
            ...ev.value,
            instances: newInstances,
          };

          // TODO: notify listeners of value change
        }
      }
    };

    canvas.addEventListener('pointerup', handlePointerUp, false);

    return {
      cleanup: () => {
        canvas.removeEventListener('pointerup', handlePointerUp, false);
        cleanup();
      },
    };
  },
};

export default spriteWorldSetupEditor;
