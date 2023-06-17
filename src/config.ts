import { Template } from './extlib/template';

import { Sprite } from './extensions/types/sprite';
import spritePreviewer from './extensions/previewers/spritePreviewer';

import { SpriteWorldSetup } from './extensions/types/spriteWorldSetup';
import spriteWorldSetupEditor from './extensions/editors/spriteWorldSetupEditor';
import spriteWorldSetupEmpty from './extensions/creators/spriteWorldSetupEmpty';
import spriteWorldRunner from './extensions/runners/spriteWorldRunner';

import spriteEditor from './extensions/editors/spriteEditor';

import { EVWrapper, createDevtimeEVWrapper } from './extlib/ev';

import witch from './sprites/witch.png';
import monster from './sprites/monster.png';
import cyclops from './sprites/cyclops.png';
import { ProgramNode } from './extensions/types/code';

export const TEMPLATE: Template = {
  pools: [
    {
      globalId: 'sprites',
      typeId: 'sprite',
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
      ext: spriteEditor,
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
      typeId: 'spriteWorldSetup',
      globalId: 'worldSetup',
    },
  },

  initEVs: async () => {
    const worldSetupEV = createDevtimeEVWrapper<SpriteWorldSetup>('spriteWorldSetup', spriteWorldSetupEmpty.create());

    const spriteEVs: Array<EVWrapper<Sprite>> = [];
    for (const url of [witch, monster, cyclops]) {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const initProg: ProgramNode = {
        type: 'Program',
        nid: 'program',
        decls: [],
      };
      const sprite = {
        imageBlob: blob,
        code: initProg,
      };
      const spriteEV = createDevtimeEVWrapper<Sprite>('sprite', sprite);
      spriteEVs.push(spriteEV);
    }

    return {
      singles: new Map([
        ['worldSetup', worldSetupEV],
      ]),
      pools: new Map([
        ['sprites', spriteEVs],
      ]),
    };
  },
};
