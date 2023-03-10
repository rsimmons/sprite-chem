import { ReactElement, useEffect, useRef } from 'react';
import { EVType, PointerID } from './extlib/common';
import { genUidRandom, invariant } from './util';
import { EXTENSION_MAP, TEMPLATE } from './config';
import { Editor, EditorReturn } from './extlib/editor';
import './EditorContainer.css';

interface EditorContainerProps<T> {
  readonly type: EVType;
  readonly initValue: T;
  readonly onChange: (newVal: T) => void;
}

const EditorContainer = <T,>({type, initValue, onChange}: EditorContainerProps<T>): ReactElement => {
  const editorExtensionId = TEMPLATE.editors[type];
  invariant(editorExtensionId);
  const editor = EXTENSION_MAP.get(editorExtensionId) as Editor<T>;
  invariant(editor);

  const containerRef = useRef<HTMLDivElement>(null);
  const editorReturnRef = useRef<EditorReturn<T> | null>(null);

  useEffect(() => {
    invariant(containerRef.current);
    // TODO: verify that `editor` does not change value?

    if (!editorReturnRef.current) {
      const ret = editor.create({
        container: containerRef.current,
        initValue,
        initDepVals: new Map(),
        valueChanged: (value) => { onChange(value); },
        addDep: (id) => { },
        removeDep: (id) => { },
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
  }, [editor]);

  return <div
    ref={containerRef}
    className="EditorContainer"
  />;
}

export default EditorContainer;
