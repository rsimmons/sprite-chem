import { Creator } from "../../extlib/creator";
import { SpriteWorldSetup } from "../types/spriteWorldSetup";

const spriteWorldSetupEmpty: Creator<SpriteWorldSetup, void> = {
  create: () => {
    return {
      instances: new Map(),
      viewport: {
        center: {x: 0, y: 0},
        size: 10,
      },
    };
  },
};

export default spriteWorldSetupEmpty;
