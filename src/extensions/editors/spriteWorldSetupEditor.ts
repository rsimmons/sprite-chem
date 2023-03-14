import { Sprite } from '../types/sprite';
import { Editor } from '../../extlib/editor';
import { SpriteWorldSetup } from '../types/spriteWorldSetup';
import { createRenderCanvas, SpriteInstances } from '../../extshared/spriteWorld';
import { AttachedDragData, EVID } from '../../extlib/common';
import { invariant } from '../../util';

const spriteWorldSetupEditor: Editor<SpriteWorldSetup> = {
  create: (context) => {
    let editedValue = context.initValue; // the EV that this editor manages, the sprite world setup

    interface CachedSpriteInfo {
      readonly sprite: Sprite;
      bitmapInfo: {
        readonly bitmap: ImageBitmap,
        // [0-1] relative to max dimension
        readonly scaledWidth: number;
        readonly scaledHeight: number;
      } | undefined;
    }
    const cachedSpriteInfo = new Map<EVID, CachedSpriteInfo>();

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
    editedValue.instances.forEach((insts, spriteEVId) => {
      const sprite = context.initDepVals.get(spriteEVId) as Sprite;
      invariant(sprite);
      const info: CachedSpriteInfo = {
        sprite,
        bitmapInfo: undefined,
      };
      cachedSpriteInfo.set(spriteEVId, info);
      loadBitmap(info);
    });

    const {cleanup, canvas, pixelScale} = createRenderCanvas(context.container, () => {
      // this is getState callback
      const renderInsts: Map<string, SpriteInstances> = new Map();
      editedValue.instances.forEach((insts, evId) => {
        const info = cachedSpriteInfo.get(evId);
        invariant(info);
        if (info.bitmapInfo) {
          const bi = info.bitmapInfo;
          renderInsts.set(evId, {
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
        if (dragData.type === 'sprite') {
          const newInstances = new Map(editedValue.instances);
          if (!newInstances.has(dragData.evId)) {
            newInstances.set(dragData.evId, []);
            context.addRef(dragData.evId);
            const sprite = dragData.value as Sprite;
            const info: CachedSpriteInfo = {
              sprite,
              bitmapInfo: undefined,
            };
            cachedSpriteInfo.set(dragData.evId, info);
            loadBitmap(info);
          }

          const rect = canvas.getBoundingClientRect();
          newInstances.set(dragData.evId, newInstances.get(dragData.evId)!.concat([{
            // NOTE: position we create is for center of sprite, but in dragData
            // position is for top-left corner of containing square
            pos: {
              x: pixelScale*(e.clientX - rect.left + dragData.size*(0.5 - dragData.offset.x)),
              y: pixelScale*(e.clientY - rect.top + dragData.size*(0.5 - dragData.offset.y)),
            },
            size: pixelScale*dragData.size,
          }]));

          editedValue = {
            ...editedValue,
            instances: newInstances,
          };

          context.valueChanged(editedValue);
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
