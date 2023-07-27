import { Sprite } from '../types/sprite';
import { Editor, DragInfo, PointerEventData } from '../../extlib/editor';
import { SpriteWorldSetup } from '../types/spriteWorldSetup';
import { createRenderCanvas, SpriteInstances } from '../../extshared/spriteWorld';
import { invariant } from '../../util';
import { EVWrapper } from '../../extlib/ev';
import { useEffect } from 'react';

const spriteWorldSetupEditor: Editor<SpriteWorldSetup, undefined> = {
  create: (context) => {
    let editedValue = context.initialValue;

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
    editedValue.instances.forEach((insts, spriteEV) => {
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
      editedValue.instances.forEach((insts, spriteEV) => {
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

    const getEventDragInfo = (e: PointerEvent): DragInfo | undefined => {
      return (e as any).dragInfo as (DragInfo | undefined);
    }

    const handlePointerUp = (e: Event) => {
      const ed = (e as CustomEvent<PointerEventData>).detail;
      invariant(ed);

      const di = ed.dragInfo;
      if (di) {
        if ((di.payload.type === 'ev') && (di.payload.ev.typeId === 'sprite')) {
          const spriteEV = di.payload.ev as EVWrapper<Sprite>;
          const newInstances = new Map(editedValue.instances);
          if (!newInstances.has(spriteEV)) {
            newInstances.set(spriteEV, []);
            const info: CachedSpriteInfo = {
              sprite: spriteEV.value,
              bitmapInfo: undefined,
            };
            cachedSpriteInfo.set(spriteEV, info);
            loadBitmap(info);
          }

          const rect = canvas.getBoundingClientRect();
          newInstances.set(spriteEV, newInstances.get(spriteEV)!.concat([{
            // NOTE: position we create is for center of sprite, but in di
            // position is for top-left corner of containing square
            pos: {
              x: pixelScale*(ed.pos.x - rect.left + di.width*(0.5 - di.offset.x)),
              y: pixelScale*(ed.pos.y - rect.top + di.height*(0.5 - di.offset.y)),
            },
            size: pixelScale*di.width,
          }]));

          editedValue = {
            ...editedValue,
            instances: newInstances,
          };

          context.valueChanged(editedValue);
        }
      }
    };

    context.pointerEventTarget.addEventListener('pointerUp', handlePointerUp);

    return {
      cleanup: () => {
        context.pointerEventTarget.removeEventListener('pointerUp', handlePointerUp);
        cleanup();
      },
    };
  },
};

export default spriteWorldSetupEditor;
