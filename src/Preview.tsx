import { ReactElement, useEffect, useRef } from "react";
import { PreviewerReturn } from "./extlib/previewer";
import { invariant } from "./util";
import { EXTENSION_MAP, TEMPLATE } from "./config";
import { EVType } from "./extlib/common";
import './Preview.css';

interface PoolTabPanelProps<T> {
  readonly type: EVType;
  readonly value: T;
}

const Preview = <T,>({type, value}: PoolTabPanelProps<T>): ReactElement => {
  const previewerExtentionId = TEMPLATE.previewers[type];
  invariant(previewerExtentionId);
  const previewer = EXTENSION_MAP.get(previewerExtentionId);
  invariant(previewer);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewerReturnRef = useRef<PreviewerReturn<T> | null>(null);

  useEffect(() => {
    invariant(containerRef.current);
    // TODO: verify that `previewer` does not change value?

    if (previewerReturnRef.current) {
      previewerReturnRef.current.valueChanged(value);
    } else {
      previewerReturnRef.current = previewer.create({
        container: containerRef.current,
        initialValue: value,
      });
    }

    return () => {
      invariant(previewerReturnRef.current);
      if (previewerReturnRef.current.cleanup) {
        previewerReturnRef.current.cleanup();
      }
    };
  }, [value, previewer]);

  return <div ref={containerRef} className="Preview" />;
}

export default Preview;
