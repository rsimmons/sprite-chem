import { Sprite } from '../types/sprite';
import { Editor } from '../../extlib/editor';
import { SpriteWorldSetup } from '../types/spriteWorldSetup';
import { createRenderCanvas, SpriteInstances } from '../../extshared/spriteWorld';
import { AttachedDragData, EVID } from '../../extlib/common';
import { invariant } from '../../util';

const spriteWorldSetupEditor: Editor<SpriteWorldSetup> = {
  create: (context) => {
    let editedValue = context.initValue; // the EV that this editor manages, the sprite world setup
    const cachedSpriteVals = new Map<EVID, Sprite>();
    const cachedImageInfo = new Map<EVID, {
      bitmap: ImageBitmap,

      // [0-1] relative to max dimension
      scaledWidth: number;
      scaledHeight: number;
    }>;

    const loadBitmap = (evId: EVID) => {
      (async () => {
        const sprite = cachedSpriteVals.get(evId);
        invariant(sprite);
        const bitmap = await createImageBitmap(sprite.imageBlob);
        const invMaxDim = 1/Math.max(bitmap.width, bitmap.height)
        cachedImageInfo.set(evId, {
          bitmap,
          scaledWidth: invMaxDim*bitmap.width,
          scaledHeight: invMaxDim*bitmap.height,
        });
      })();
    };

    const {cleanup, canvas, pixelScale} = createRenderCanvas(context.container, () => {
      const renderInsts: Map<string, SpriteInstances> = new Map();
      editedValue.instances.forEach((insts, evId) => {
        const imgInfo = cachedImageInfo.get(evId);
        if (imgInfo) {
          renderInsts.set(evId, {
            bitmap: imgInfo.bitmap,
            scaledWidth: imgInfo.scaledWidth,
            scaledHeight: imgInfo.scaledHeight,
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
            context.addDep(dragData.evId);
            cachedSpriteVals.set(dragData.evId, dragData.value);
            loadBitmap(dragData.evId);
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
