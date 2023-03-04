import { ExtensionID } from './extlib/common';
import spritePreviewer from './extensions/previewers/spritePreviewer';
import { Template } from './extlib/template';

export const EXTENSION_MAP: ReadonlyMap<ExtensionID, any> = new Map([
  ['spritePreviewer', spritePreviewer],
]);

export const TEMPLATE: Template = {
  pools: [
    {
      id: 'sprites',
      type: 'sprite',
    },
  ],
  tabs: [
    {
      kind: 'pool',
      id: 'sprites',
      name: 'Sprites',
      pool: 'sprites',
    },
    {
      kind: 'empty',
      id: 'sounds',
      name: 'Sounds',
    },
  ],
  previewers: {
    'sprite': 'spritePreviewer',
  },
};
