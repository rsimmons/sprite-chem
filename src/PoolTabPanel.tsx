import { ReactElement, useRef, useState } from 'react';
import PreviewerContainer from './PreviewerContainer';
import { ClientXY, getObjId, invariant } from './util';
import { AppDispatch, AppState } from './state';
import './PoolTabPanel.css';
import { Vec2, vec2dist } from './vec';
import EditorContainer from './EditorContainer';
import { EVWrapper } from './extlib/ev';
import { DragTracker } from './extshared/dragTracker';
import { BeginDragEVArgs, BeginDragValueArgs } from './extlib/editor';

interface DragObj {
  readonly ev: EVWrapper<any>;
  readonly size: number;
  readonly offset: Vec2;
}

const PoolTabPanel: React.FC<{
  readonly globalId: string;
  readonly state: AppState;
  readonly pointerEventTarget: EventTarget;
  readonly onBeginDragEV: (args: BeginDragEVArgs) => void;
  readonly onBeginDragValue: (args: BeginDragValueArgs) => void;
}> = ({globalId, state, pointerEventTarget, onBeginDragEV, onBeginDragValue}) => {
  const dragTracker = useRef<DragTracker<DragObj>>(new DragTracker());

  const handlePointerDown = (e: React.PointerEvent, ev: EVWrapper<any>) => {
    e.preventDefault();

    if (!(e.target instanceof HTMLElement)) {
      throw new Error('unclear if this can happen');
    }

    e.target.setPointerCapture(e.pointerId);

    // find the nearest ancestor that's the container, for calculating offset
    let containerElem = e.target;
    while (true) {
      if (containerElem.classList.contains('PoolTabPanel-preview-container')) {
        break;
      }
      if (containerElem.parentElement) {
        containerElem = containerElem.parentElement;
      } else {
        throw new Error('did not find container elem');
      }
    }
    const rect = containerElem.getBoundingClientRect();
    const maxDim = Math.max(rect.width, rect.height);
    const offset: Vec2 = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    dragTracker.current.pointerDown(e.nativeEvent, {
      ev,
      size: maxDim,
      offset,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();

    const di = dragTracker.current.pointerMove(e.nativeEvent);
    if (di) {
      if ((di.pos.x - di.startPos.x) > 10) {
        onBeginDragEV({
          pointerId: e.pointerId,
          ev: di.obj.ev,
          pos: {
            x: di.pos.x,
            y: di.pos.y,
          },
          size: di.obj.size,
          offset: di.obj.offset,
        });
        dragTracker.current.stopTracking(e.pointerId);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();

    const di = dragTracker.current.pointerUp(e.nativeEvent);
    if (di) {
      if (vec2dist(di.pos, di.startPos) < 10) {
        setSelectedEV(di.obj.ev);
      }
    }
  };

  const poolEVs = state.pools.get(globalId);
  invariant(poolEVs);

  const [selectedEV, setSelectedEV] = useState<EVWrapper<any> | null>((poolEVs.length > 0) ? poolEVs[0] : null);

  return (
    <div className="PoolTabPanel">
      <div className="PoolTabPanel-list">{poolEVs.map((ev) => {
        return (
          <div
            key={getObjId(ev)}
            className={`PoolTabPanel-preview-container ${selectedEV === ev ? 'PoolTabPanel-preview-container-selected' : ''}`}
            onPointerDown={e => handlePointerDown(e, ev)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <PreviewerContainer ev={ev} />
          </div>
        );
      })}
      </div>
      <div className="PoolTabPanel-editor">
        {selectedEV && (
          <EditorContainer
            key={getObjId(selectedEV)}
            ev={selectedEV}
            pointerEventTarget={pointerEventTarget}
            onBeginDragValue={onBeginDragValue}
          />
        )}
      </div>
    </div>
  );
}

export default PoolTabPanel;
