import { ReactElement, useEffect, useRef } from "react";
import { Previewer, PreviewerReturn } from "./extlib/previewer";
import { invariant } from "./util";
import { TEMPLATE } from "./config";
import { EVID, EVType } from "./extlib/common";
import { AppState } from "./newState";
import './PreviewerContainer.css';
import { useConstant } from "./utilReact";

const PreviewerContainer: React.FC<{
  readonly evId: EVID;
  readonly state: AppState;
}> = ({evId, state}) => {
  useConstant(evId);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewerReturnRef = useRef<PreviewerReturn<any> | null>(null);

  useEffect(() => {
    invariant(containerRef.current);

    const ev = state.evs.get(evId);
    invariant(ev);

    const previewer = TEMPLATE.previewers[ev.type];
    invariant(previewer);

    const initValue = ev.value;

    invariant(!previewerReturnRef.current);
    previewerReturnRef.current = previewer.create({
      container: containerRef.current,
      initValue,
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
