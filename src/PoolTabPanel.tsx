import { ReactElement, useState } from 'react';
import PreviewerContainer from './PreviewerContainer';
import { ClientXY, getObjId, invariant } from './util';
import { AppDispatch, AppState } from './newState';
import './PoolTabPanel.css';
import { Vec2 } from './vec';
import EditorContainer from './EditorContainer';
import { EVWrapper } from './extlib/ev';

const PoolTabPanel: React.FC<{
  readonly globalId: string;
  readonly state: AppState;
  readonly dispatch: AppDispatch;
}> = ({globalId, state, dispatch}) => {
  const handlePointerDown = (e: React.PointerEvent, ev: EVWrapper<any>) => {
    e.preventDefault();

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
      ev,
      pos: {
        x: e.clientX,
        y: e.clientY,
      },
      size: maxDim,
      offset,
    });
  };

  const handleClick = (e: React.MouseEvent, ev: EVWrapper<any>) => {
    e.preventDefault();

    setSelectedEV(ev);
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
            onClick={e => handleClick(e, ev)}
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
            dispatch={dispatch}
          />
        )}
      </div>
    </div>
  );
}

export default PoolTabPanel;
