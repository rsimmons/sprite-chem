import { Sprite } from '../types/sprite';
import { Editor, DragInfo, PointerEventData } from '../../extlib/editor';
import { SpriteInstance, SpriteWorldSetup } from '../types/spriteWorldSetup';
import { createRenderCanvas, getWorldToCanvasXform, SpriteInstances } from '../../extshared/spriteWorld';
import { arrRemoveElemByValueInPlace, invariant } from '../../util';
import { EVWrapper } from '../../extlib/ev';
import { applyInvSTXform } from '../../vec';

interface DraggedInstanceData {
  readonly spriteEV: EVWrapper<Sprite>;
  readonly size: number;
}

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

    const getBitmapInfo = (bitmap: ImageBitmap): CachedSpriteInfo['bitmapInfo'] => {
      const invMaxDim = 1/Math.max(bitmap.width, bitmap.height);
      return {
        bitmap,
        scaledWidth: invMaxDim*bitmap.width,
        scaledHeight: invMaxDim*bitmap.height,
      };
    }

    // handle dependencies of initial value
    editedValue.instances.forEach((insts, spriteEV) => {
      const info: CachedSpriteInfo = {
        sprite: spriteEV.value,
        bitmapInfo: getBitmapInfo(spriteEV.value.imageBitmap),
      };
      cachedSpriteInfo.set(spriteEV, info);
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
        viewport: editedValue.viewport,
      };
    });

    const handlePointerDown = (e: Event) => {
      invariant(e instanceof PointerEvent);
      const rect = canvas.getBoundingClientRect();
      const canvasPos = {x: pixelScale*(e.clientX - rect.left), y: pixelScale*(e.clientY - rect.top)};
      const worldCanvasXform = getWorldToCanvasXform(editedValue.viewport, canvas.width, canvas.height);
      const worldPos = applyInvSTXform(worldCanvasXform, canvasPos);
      let hitSprite: EVWrapper<Sprite> | undefined;
      let hitInst: SpriteInstance | undefined;
      for (const [sprite, insts] of editedValue.instances.entries()) {
        for (const inst of insts) {
          if ((worldPos.x >= inst.pos.x - 0.5*inst.size) &&
              (worldPos.x <= inst.pos.x + 0.5*inst.size) &&
              (worldPos.y >= inst.pos.y - 0.5*inst.size) &&
              (worldPos.y <= inst.pos.y + 0.5*inst.size)) {
            hitSprite = sprite;
            hitInst = inst;
            break;
          }
        }
      }

      if (hitSprite) {
        invariant(hitInst);

        arrRemoveElemByValueInPlace(editedValue.instances.get(hitSprite)!, hitInst);

        const dragValue: DraggedInstanceData = {
          spriteEV: hitSprite,
          size: hitInst.size,
        };

        const previewElem = document.createElement('div');
        previewElem.innerHTML = 'sprite';

        context.beginDragValue({
          pointerId: e.pointerId,
          typeId: 'spriteWorldSetupEditor/instance',
          value: dragValue,
          pos: {x: e.clientX, y: e.clientY},
          previewElem,
          offset: {x: 0, y: 0}, // TODO: compute offset
        });
      }
    };

    const handlePointerUp = (e: Event) => {
      const ed = (e as CustomEvent<PointerEventData>).detail;
      invariant(ed);

      const di = ed.dragInfo;
      if (di) {
        const addInstance = (spriteEV: EVWrapper<Sprite>, worldCenter: {x: number, y: number}, worldSize: number): void => {
          if (!editedValue.instances.has(spriteEV)) {
            editedValue.instances.set(spriteEV, []);
            const info: CachedSpriteInfo = {
              sprite: spriteEV.value,
              bitmapInfo: getBitmapInfo(spriteEV.value.imageBitmap),
            };
            cachedSpriteInfo.set(spriteEV, info);
          }

          const insts = editedValue.instances.get(spriteEV)!;
          insts.push({
            pos: worldCenter,
            size: worldSize,
          });

          context.valueChanged(editedValue);
        };

        const rect = canvas.getBoundingClientRect();
        const canvasCenter = { // center in canvas coords
          x: pixelScale*(ed.pos.x - rect.left - di.offset.x + 0.5*di.dims.x),
          y: pixelScale*(ed.pos.y - rect.top - di.offset.y + 0.5*di.dims.y),
        };
        const worldCanvasXform = getWorldToCanvasXform(editedValue.viewport, canvas.width, canvas.height);
        const worldCenter = applyInvSTXform(worldCanvasXform, canvasCenter);

        if ((di.payload.type === 'ev') && (di.payload.ev.typeId === 'sprite')) {
          const spriteEV = di.payload.ev as EVWrapper<Sprite>;

          addInstance(spriteEV, worldCenter, pixelScale*Math.max(di.dims.x, di.dims.y)/worldCanvasXform.s);
        } else if ((di.payload.type === 'value') && (di.payload.typeId === 'spriteWorldSetupEditor/instance')) {
          const val = di.payload.value as DraggedInstanceData;
          addInstance(val.spriteEV, worldCenter, val.size);
        }
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    context.pointerEventTarget.addEventListener('pointerUp', handlePointerUp);

    return {
      cleanup: () => {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        context.pointerEventTarget.removeEventListener('pointerUp', handlePointerUp);
        cleanup();
      },
    };
  },
};

export default spriteWorldSetupEditor;
