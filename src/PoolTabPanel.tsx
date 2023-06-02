import { ReactElement, useState } from 'react';
import { EVID, EVType, PointerID } from './extlib/common';
import PreviewerContainer from './PreviewerContainer';
import { ClientXY, invariant } from './util';
import { AppDispatch, AppState } from './newState';
import './PoolTabPanel.css';
import { Vec2 } from './vec';
import EditorContainer from './EditorContainer';

const PoolTabPanel: React.FC<{
  readonly globalId: string;
  readonly state: AppState;
  readonly dispatch: AppDispatch;
}> = ({globalId, state, dispatch}) => {
  const handlePointerDown = (e: React.PointerEvent, evId: string) => {
    e.preventDefault();

    setSelectedEVId(evId);

    // release capture if we implicitly got it (happens with touch by default)
    if (!(e.target instanceof HTMLElement)) {
      throw new Error('unclear if this can happen');
    }

    if (e.target.hasPointerCapture(e.pointerId)) {
      e.target.releasePointerCapture(e.pointerId);
    }

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
      x: (e.clientX - rect.left)/maxDim,
      y: (e.clientY - rect.top)/maxDim,
    };

    dispatch({
      type: 'pointerDownOnEV',
      pointerId: e.pointerId,
      evId,
      pos: {
        x: e.clientX,
        y: e.clientY,
      },
      size: maxDim,
      offset,
    });
  };

  const poolEVIds = state.pools.get(globalId);
  invariant(poolEVIds);
  const evVals = poolEVIds.map(evid => [evid, state.evs.get(evid)!.value]);

  const [selectedEVId, setSelectedEVId] = useState<EVID | null>((poolEVIds.length > 0) ? poolEVIds[0] : null);

  return (
    <div className="PoolTabPanel">
      <div className="PoolTabPanel-list">{evVals.map(([evId, val]) => {
        return (
          <div
            key={evId}
            className={`PoolTabPanel-preview-container ${selectedEVId === evId ? 'PoolTabPanel-preview-container-selected' : ''}`}
            onPointerDown={e => handlePointerDown(e, evId)}
          >
            <PreviewerContainer evId={evId} state={state} />
          </div>
        );
      })}
      </div>
      <div className="PoolTabPanel-editor">
        {selectedEVId && (
          <EditorContainer
            key={selectedEVId}
            evId={selectedEVId}
            state={state}
            dispatch={dispatch}
          />
        )}
      </div>
    </div>
  );
}

export default PoolTabPanel;
