import { Creator } from "../../extlib/creator";
import { SpriteWorldSetup } from "../types/spriteWorldSetup";

const spriteWorldSetupEmpty: Creator<SpriteWorldSetup, void> = {
  create: () => {
    return {
      instances: new Map(),
    };
  },
};

export default spriteWorldSetupEmpty;
