import { useEffect, useRef } from 'react';
import { EVID } from './extlib/common';
import { invariant } from './util';
import { EXTENSION_MAP, TEMPLATE } from './config';
import { Editor, EditorReturn } from './extlib/editor';
import { AppDispatch, AppState } from './newState';
import { useConstant } from './utilReact';
import './EditorContainer.css';

const EditorContainer: React.FC<{
  readonly evId: EVID;
  readonly state: AppState;
  readonly dispatch: AppDispatch;
}> = ({evId, state, dispatch}) => {
  useConstant(evId);
  useConstant(dispatch);

  const containerRef = useRef<HTMLDivElement>(null);
  const editorReturnRef = useRef<EditorReturn<any> | null>(null);

  useEffect(() => {
    invariant(containerRef.current);

    const ev = state.evs.get(evId);
    invariant(ev);

    const extensionId = TEMPLATE.editors[ev.type];
    invariant(extensionId);

    const editor = EXTENSION_MAP.get(extensionId) as Editor<any>;
    invariant(editor);

    const initValue = ev.val;

    const initDepVals = new Map(Array.from(ev.refs).map(refId => {
      const ev = state.evs.get(refId);
      invariant(ev);
      return [refId, ev.val];
    }));

    invariant(!editorReturnRef.current);
    editorReturnRef.current = editor.create({
      container: containerRef.current,
      initValue,
      initDepVals,
      valueChanged: (newVal) => { dispatch({type: 'evUpdate', evId, val: newVal}); },
      addRef: (refId) => { dispatch({type: 'evAddRef', evId, refId}); },
      removeRef: (refId) => { dispatch({type: 'evRemoveRef', evId, refId}); },
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
