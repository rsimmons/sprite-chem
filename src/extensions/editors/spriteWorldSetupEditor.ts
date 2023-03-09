import { Sprite } from '../types/sprite';
import { Editor } from '../../extlib/editor';
import { SpriteWorldSetup } from '../types/spriteWorldSetup';
import { createRenderCanvas } from '../../extshared/spriteWorld';
import { EVID } from '../../extlib/common';

const spriteWorldSetupEditor: Editor<SpriteWorldSetup> = {
  create: (context) => {
    let editedValue = context.initValue; // the EV that this editor manages, the sprite world setup
    const cachedSpriteVals = new Map<EVID, Sprite>();

    const cleanupCanvas = createRenderCanvas(context.container, () => ({instances: new Map()}));

    return {
      checkEVDrag: (type, id, curValue, event) => {
        return (type === 'sprite');
      },

      endEVDrag: (type, id, curValue, event) => {
        if (type === 'sprite') {
          const newInstances = new Map(editedValue.instances);
          if (!newInstances.has(id)) {
            newInstances.set(id, []);
            context.addDep(id);
            cachedSpriteVals.set(id, curValue);
          }
          newInstances.set(id, newInstances.get(id)!.concat([{
            pos: {x: 0, y: 0},
            size: 10,
          }]));

          editedValue = {
            ...editedValue,
            instances: newInstances,
          };

          console.log({editedValue});

          context.valueChanged(editedValue);
        }
      },

      cleanup: () => {
        cleanupCanvas();
      },
    };
  },
};

export default spriteWorldSetupEditor;
