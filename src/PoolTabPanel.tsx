import { ReactElement } from 'react';
import { EVID, EVType, PointerID } from './extlib/common';
import PreviewerContainer from './PreviewerContainer';
import { ClientXY } from './util';
import { AppDispatch } from './newState';
import './PoolTabPanel.css';

// T is the underlying value type of the pool items
interface PoolTabPanelProps<T> {
  readonly evs: ReadonlyArray<[EVID, T]>;
  readonly type: EVType;
  readonly dispatch: AppDispatch;
}

const PoolTabPanel = <T,>({evs, type, dispatch}: PoolTabPanelProps<T>): ReactElement => {
  const handlePointerDown = (e: React.PointerEvent, evId: string) => {
    e.preventDefault();

    // release capture if we implicitly got it (happens with touch by default)
    if (!(e.target instanceof HTMLElement)) {
      throw new Error('unclear if this can happen');
    }

    if (e.target.hasPointerCapture(e.pointerId)) {
      e.target.releasePointerCapture(e.pointerId);
    }

    // find the nearest ancestor that's the container, so calculating offset
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

    dispatch({
      type: 'pointerDownOnEV',
      pointerId: e.pointerId,
      evId,
      pos: {
        x: e.clientX,
        y: e.clientY,
      },
      size: maxDim,
      offset: {
        x: (e.clientX - rect.left)/maxDim,
        y: (e.clientY - rect.top)/maxDim,
      },
    });
  };

  return (
    <div className="PoolTabPanel">
      <div className="PoolTabPanel-list">{evs.map(([evId, val]) => {
        return (
          <div
            key={evId}
            className="PoolTabPanel-preview-container"
            onPointerDown={e => handlePointerDown(e, evId)}
          >
            <PreviewerContainer type={type} value={val} />
          </div>
        );
      })}
      </div>
      <div className="PoolTabPanel-editor"></div>
    </div>
  );
}

export default PoolTabPanel;
