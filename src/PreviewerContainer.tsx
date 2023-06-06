import { useEffect, useRef } from "react";
import { PreviewerReturn } from "./extlib/previewer";
import { invariant } from "./util";
import { TEMPLATE } from "./config";
import './PreviewerContainer.css';
import { useConstant } from "./utilReact";
import { EVWrapper } from "./extlib/ev";

const PreviewerContainer: React.FC<{
  readonly ev: EVWrapper<any>;
}> = ({ev}) => {
  useConstant(ev);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewerReturnRef = useRef<PreviewerReturn<any> | null>(null);

  useEffect(() => {
    invariant(containerRef.current);

    const previewer = TEMPLATE.previewers[ev.typeId];
    invariant(previewer);

    invariant(!previewerReturnRef.current);
    previewerReturnRef.current = previewer.create({
      container: containerRef.current,
      ev,
    });

    return () => {
      invariant(previewerReturnRef.current);
      if (previewerReturnRef.current.cleanup) {
        previewerReturnRef.current.cleanup();
      }
      previewerReturnRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="PreviewerContainer" />;
}

export default PreviewerContainer;
