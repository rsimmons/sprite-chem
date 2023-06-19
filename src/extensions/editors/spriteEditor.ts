import { Editor, EditorContext } from "../../extlib/editor";
import { Code } from "../types/code";
import { Sprite } from "../types/sprite";
import codeEditor from "./codeEditor";

const spriteEditor: Editor<Sprite, undefined> = {
  create: (context) => {
    let editedValue = context.initialValue;

    const codeEditorCtx: EditorContext<Code, undefined> = {
      container: context.container,
      initialValue: context.initialValue.code,
      valueChanged: (newValue) => {
        editedValue = {
          ...editedValue,
          code: newValue,
        };
        context.valueChanged(editedValue);
      },
      config: undefined,
      beginDrag: context.beginDrag,
      getPreviewer: context.getPreviewer,
    };

    const codeEditorRet = codeEditor.create(codeEditorCtx);

    return {
      cleanup: () => {
        if (codeEditorRet.cleanup) {
          codeEditorRet.cleanup();
        }
      },
    };
  },
};

export default spriteEditor;
