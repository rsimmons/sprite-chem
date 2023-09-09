import { useEffect, useRef } from 'react';
import { invariant } from './util';
import { TEMPLATE } from './config';
import { BeginDragValueArgs, EditorReturn } from './extlib/editor';
import { useConstant } from './utilReact';
import './EditorContainer.css';
import { EVWrapper } from './extlib/ev';

const EditorContainer: React.FC<{
  readonly ev: EVWrapper<any>;
  readonly pointerEventTarget: EventTarget;
  readonly onBeginDragValue: (args: BeginDragValueArgs) => void;
}> = ({ev, onBeginDragValue, pointerEventTarget}) => {
  useConstant(ev);
  // TODO: useConstant(onBeginDragValue), etc?

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
        onBeginDragValue(args);
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
