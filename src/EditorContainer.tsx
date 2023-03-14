import { ReactElement, useEffect, useRef } from 'react';
import { EVID, EVType, PointerID } from './extlib/common';
import { genUidRandom, invariant } from './util';
import { EXTENSION_MAP, TEMPLATE } from './config';
import { Editor, EditorReturn } from './extlib/editor';
import './EditorContainer.css';

interface EditorContainerProps<T> {
  readonly type: EVType;
  readonly initValue: T;
  readonly initDepVals: ReadonlyMap<EVID, any>;
  readonly onChange: (newVal: T) => void;
  readonly onAddRef: (evId: EVID) => void;
  readonly onRemoveRef: (evId: EVID) => void;
}

const EditorContainer = <T,>({type, initValue, initDepVals, onChange, onAddRef, onRemoveRef}: EditorContainerProps<T>): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorReturnRef = useRef<EditorReturn<T> | null>(null);

  useEffect(() => {
    invariant(containerRef.current);

    const editorExtensionId = TEMPLATE.editors[type];
    invariant(editorExtensionId);
    const editor = EXTENSION_MAP.get(editorExtensionId) as Editor<T>;
    invariant(editor);

    if (!editorReturnRef.current) {
      const ret = editor.create({
        container: containerRef.current,
        initValue,
        initDepVals,
        valueChanged: (value) => { onChange(value); },
        addRef: (evId) => { onAddRef(evId); },
        removeRef: (evId) => { onRemoveRef(evId); },
      });
      editorReturnRef.current = ret;
    }

    return () => {
      invariant(editorReturnRef.current);
      if (editorReturnRef.current.cleanup) {
        editorReturnRef.current.cleanup();
      }
      editorReturnRef.current = null;
    };
  }, []);

  return <div
    ref={containerRef}
    className="EditorContainer"
  />;
}

export default EditorContainer;
