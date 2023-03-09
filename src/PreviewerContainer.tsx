import { ReactElement, useEffect, useRef } from "react";
import { Previewer, PreviewerReturn } from "./extlib/previewer";
import { invariant } from "./util";
import { EXTENSION_MAP, TEMPLATE } from "./config";
import { EVType } from "./extlib/common";
import './PreviewerContainer.css';

interface PreviewerContainerProps<T> {
  readonly type: EVType;
  readonly value: T;
}

const PreviewerContainer = <T,>({type, value}: PreviewerContainerProps<T>): ReactElement => {
  const previewerExtensionId = TEMPLATE.previewers[type];
  invariant(previewerExtensionId);
  const previewer = EXTENSION_MAP.get(previewerExtensionId) as Previewer<T>;
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

  return <div ref={containerRef} className="PreviewerContainer" />;
}

export default PreviewerContainer;
