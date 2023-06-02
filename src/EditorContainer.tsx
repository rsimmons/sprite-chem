import { useEffect, useRef } from 'react';
import { EVID } from './extlib/common';
import { invariant } from './util';
import { EXTENSION_MAP, TEMPLATE } from './config';
import { Editor, EditorReturn } from './extlib/editor';
import { AppDispatch, AppState, getEvTransitiveRefInfos } from './newState';
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

    const extInfo = TEMPLATE.editors[ev.type];
    invariant(extInfo);
    const extensionId = extInfo.extId;
    const config = extInfo.config;

    const editor = EXTENSION_MAP.get(extensionId) as Editor<any, any>;
    invariant(editor);

    const initValue = ev.value;

    const initRefVals = getEvTransitiveRefInfos(state, [evId]);

    invariant(!editorReturnRef.current);
    editorReturnRef.current = editor.create({
      config,
      container: containerRef.current,
      initValue,
      initRefVals,
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
