import { useEffect, useRef } from 'react';
import { invariant } from './util';
import { TEMPLATE } from './config';
import { Editor, EditorReturn, PointerID } from './extlib/editor';
import { AppDispatch } from './newState';
import { useConstant } from './utilReact';
import './EditorContainer.css';
import { EVWrapper } from './extlib/ev';
import { EVTypeId } from './extlib/type';

const EditorContainer: React.FC<{
  readonly ev: EVWrapper<any>;
  readonly dispatch: AppDispatch;
  readonly pointerEventTarget: EventTarget;
}> = ({ev, dispatch, pointerEventTarget}) => {
  useConstant(ev);
  useConstant(dispatch);

  const containerRef = useRef<HTMLDivElement>(null);
  const editorReturnRef = useRef<EditorReturn<any> | null>(null);

  useEffect(() => {
    invariant(containerRef.current);

    const extInfo = TEMPLATE.editors[ev.typeId];
    invariant(extInfo);

    const editor = extInfo.ext;
    invariant(editor);

    const config = extInfo.config;

    invariant(!editorReturnRef.current);
    editorReturnRef.current = editor.create({
      config,
      container: containerRef.current,
      initialValue: ev.value,
      valueChanged: (newValue) => {
        ev.setValue(newValue);
      },
      beginDragValue: (args) => {
        const {pointerId, typeId, value, pos, offset, dims, previewElem} = args;
        dispatch({
          type: 'beginDragValue',
          pointerId,
          typeId,
          value,
          pos,
          offset,
          dims,
          previewElem,
        });
      },
      pointerEventTarget,
      getPreviewer: (typeId) => {
        return TEMPLATE.previewers[typeId];
      },
    });

    return () => {
      invariant(editorReturnRef.current);
      if (editorReturnRef.current.cleanup) {
        editorReturnRef.current.cleanup();
      }
      editorReturnRef.current = null;
    };

    // eslint-ignore-next-line react-hooks/exhaustive-deps
  }, []);

  return <div
    ref={containerRef}
    className="EditorContainer"
  />;
}

export default EditorContainer;
