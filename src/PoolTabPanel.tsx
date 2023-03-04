import { ReactElement } from 'react';
import { EVID, EVType, PointerID } from './extlib/common';
import Preview from './Preview';
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
  const handlePointerStart = (evId: EVID, pointerId: PointerID, target: Element, pos: ClientXY): void => {
    const rect = target.getBoundingClientRect();
    const maxDim = Math.max(rect.width, rect.height);

    dispatch({
      type: 'pointerStartOnEV',
      pointerId,
      evId,
      pos: {
        x: pos.clientX,
        y: pos.clientY,
      },
      size: maxDim,
      offset: {
        x: (pos.clientX - rect.left)/maxDim,
        y: (pos.clientY - rect.top)/maxDim,
      },
    });
  };
  const handleListItemMouseDown = (e: React.MouseEvent, evId: string) => {
    e.preventDefault();

    handlePointerStart(evId, 'mouse', e.currentTarget, e);
  };
  const handleListItemTouchStart = (e: React.TouchEvent, evId: string) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      handlePointerStart(evId, touch.identifier, e.currentTarget, touch);
    }
  };

  return (
    <div className="PoolTabPanel">
      <div className="PoolTabPanel-list">{evs.map(([evId, val]) => {
        return (
          <div
            key={evId}
            className="PoolTabPanel-preview-container"
            onMouseDown={e => handleListItemMouseDown(e, evId)}
            onTouchStart={e => handleListItemTouchStart(e, evId)}
          >
            <Preview type={type} value={val} />
          </div>
        );
      })}
      </div>
      <div className="PoolTabPanel-editor"></div>
    </div>
  );
}

export default PoolTabPanel;
