import { Sprite } from '../types/sprite';
import { Editor } from '../../extlib/editor';
import { SpriteWorldSetup } from '../types/spriteWorldSetup';

const spriteWorldInitEditor: Editor<SpriteWorldSetup> = {
  create: (context) => {
    return {
      initialValue: {
        instances: new Map(),
      },
      saveState: () => { throw new Error('unimplemented'); },
    };
  },
};

export default spriteWorldInitEditor;
