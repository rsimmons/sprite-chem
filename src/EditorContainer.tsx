import { useEffect, useRef } from 'react';
import { invariant } from './util';
import { TEMPLATE } from './config';
import { Editor, EditorReturn } from './extlib/editor';
import { AppDispatch } from './newState';
import { useConstant } from './utilReact';
import './EditorContainer.css';
import { EVWrapper } from './extlib/ev';

const EditorContainer: React.FC<{
  readonly ev: EVWrapper<any>;
  readonly dispatch: AppDispatch;
}> = ({ev, dispatch}) => {
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
      ev,
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
