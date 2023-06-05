import { Template } from './extlib/template';
import spritePreviewer from './extensions/previewers/spritePreviewer';
import spriteWorldSetupEditor from './extensions/editors/spriteWorldSetupEditor';
import spriteWorldSetupEmpty from './extensions/creators/spriteWorldSetupEmpty';
import spriteWorldRunner from './extensions/runners/spriteWorldRunner';
import codeEditor from './extensions/editors/codeEditor';

export const TEMPLATE: Template = {
  pools: [
    {
      globalId: 'sprites',
      type: 'sprite',
    },
  ],
  tabs: [
    {
      kind: 'pool',
      tabId: 'sprites',
      name: 'Sprites',
      globalId: 'sprites',
    },
    {
      kind: 'empty',
      tabId: 'sounds',
      name: 'Sounds',
    },
  ],

  creators: {
    'spriteWorldSetup': [
      spriteWorldSetupEmpty,
    ],
  },
  previewers: {
    'sprite': spritePreviewer,
  },
  editors: {
    'sprite': {
      ext: codeEditor,
    },
    'spriteWorldSetup': {
      ext: spriteWorldSetupEditor,
    },
  },

  outputPanel: {
    'runner': {
      ext: spriteWorldRunner,
      singleGlobalIds: {
        'worldSetup': 'worldSetup',
      },
    },
    'stoppedEditor': {
      type: 'spriteWorldSetup',
      globalId: 'worldSetup',
    },
  },
};
