import { Template } from './extlib/template';
import { ExtensionID } from './extlib/common';
import spritePreviewer from './extensions/previewers/spritePreviewer';
import spriteWorldSetupEditor from './extensions/editors/spriteWorldSetupEditor';
import spriteWorldSetupEmpty from './extensions/creators/spriteWorldSetupEmpty';
import spriteWorldRunner from './extensions/runners/spriteWorldRunner';

export const EXTENSION_MAP: ReadonlyMap<ExtensionID, any> = new Map<ExtensionID, any>([
  ['spritePreviewer', spritePreviewer],
  ['spriteWorldSetupEditor', spriteWorldSetupEditor],
  ['spriteWorldSetupEmpty', spriteWorldSetupEmpty],
  ['spriteWorldRunner', spriteWorldRunner],
]);

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
      'spriteWorldSetupEmpty',
    ],
  },
  previewers: {
    'sprite': 'spritePreviewer',
  },
  editors: {
    'spriteWorldSetup': 'spriteWorldSetupEditor',
  },

  outputPanel: {
    'runner': {
      extId: 'spriteWorldRunner',
      singleGlobalIds: {
        'worldSetup': 'worldSetup',
      },
    },
    'stoppedEditor': {
      type: 'spriteWorldSetup',
      // extId: 'spriteWorldSetupEditor',
      globalId: 'worldSetup',
    },
  },
};
