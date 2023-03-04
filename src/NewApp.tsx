import React, { useEffect, useReducer, useState } from 'react';

import PoolTabPanel from './PoolTabPanel';
import { PointerID } from './extlib/common';
import { ClientXY, invariant } from './util';
import { INIT_STATE, reducer } from './newState';
import Preview from './Preview';
import { vec2scale, vec2sub } from './vec';
import './NewApp.css';

import witch from './sprites/witch.png';
import monster from './sprites/monster.png';
import cyclops from './sprites/cyclops.png';
import { TEMPLATE } from './config';

const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, INIT_STATE);

  useEffect(() => {
    (async () => {
      for (const url of [witch, monster, cyclops]) {
        const resp = await fetch(url);
        const blob = await resp.blob();
        dispatch({type: 'addSprite', blob});
      }
    })();
  }, []);

  const handlePointerMove = (pointerId: PointerID, pos: ClientXY): void => {
    dispatch({
      type: 'pointerMove',
      pointerId,
      pos: {
        x: pos.clientX,
        y: pos.clientY,
      },
    });
  };
  const handleWindowMouseMove = (e: MouseEvent) => {
    e.preventDefault();

    handlePointerMove('mouse', e);
  };
  const handleWindowTouchMove = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      handlePointerMove(touch.identifier, touch);
    }
  };

  const handlePointerEnd = (pointerId: PointerID, pos: ClientXY): void => {
    dispatch({
      type: 'pointerEnd',
      pointerId,
      pos: {
        x: pos.clientX,
        y: pos.clientY,
      },
    });
  };
  const handleWindowMouseUp = (e: MouseEvent) => {
    e.preventDefault();

    handlePointerEnd('mouse', e);
  };
  const handleWindowTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      handlePointerEnd(touch.identifier, touch);
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleWindowMouseMove, false);
    window.addEventListener('mouseup', handleWindowMouseUp, false);
    window.addEventListener('touchmove', handleWindowTouchMove, false);
    window.addEventListener('touchend', handleWindowTouchEnd, false);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove, false);
      window.removeEventListener('mouseup', handleWindowMouseUp, false);
      window.removeEventListener('touchmove', handleWindowTouchMove, false);
      window.removeEventListener('touchend', handleWindowTouchEnd, false);
    };
  });

  const handleTabLinkClick = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();

    setActiveTabId(tabId);
  };

  const handleRunningToggleClick = (e: React.MouseEvent) => {
    dispatch({
      type: 'toggleRunning',
    });
  };

  const [activeTabId, setActiveTabId] = useState(TEMPLATE.tabs[0].id);

  return (
    <div className="App">
      <div className="App-output-rest">
        <div className="App-header">
          <div className="App-tab-links">{TEMPLATE.tabs.map(tab => {
            return <a key={tab.id} className={'App-tab-link ' + ((tab.id === activeTabId) ? 'App-tab-link-active' : 'App-tab-link-inactive')} href="#tab" onClick={(e) => handleTabLinkClick(e, tab.id)}>{tab.name}</a>
          })}</div>
          <div className="App-run-controls">
            <button onClick={handleRunningToggleClick}>
              {state.running ? 'Edit' : 'Run'}
            </button>
          </div>
        </div>
        <div className="App-tab-area">{TEMPLATE.tabs.map(tab => {
          return (
            <div key={tab.id} className={'App-tab-container ' + ((tab.id === activeTabId) ? 'App-tab-container-active' : 'App-tab-container-inactive')}>{
              (() => {
                switch (tab.kind) {
                  case 'empty':
                    return null;

                  case 'pool': {
                    const pool = TEMPLATE.pools.find(p => (p.id === tab.pool));
                    invariant(pool);
                    const poolEVIds = state.pools.get(pool.id);
                    invariant(poolEVIds);
                    return <PoolTabPanel evs={poolEVIds.map(evid => [evid, state.evs.get(evid)!.val])} type={pool.type} dispatch={dispatch} />
                  }
                }

              })()
            }</div>
          );
        })}
        </div>
      </div>
      <div className="App-output">
      </div>
      <div className="App-drags">
        {state.dragStates.map(ds => {
          switch (ds.type) {
            case 'draggingEV': {
              const ev = state.evs.get(ds.evId);
              invariant(ev);
              const adjPos = vec2sub(ds.pos, vec2scale(ds.offset, ds.size));
              return (
                <div
                  key={ds.pointerId}
                  style={{
                    position: 'absolute',
                    left: adjPos.x,
                    top: adjPos.y,
                    width: `${ds.size}px`,
                    height: `${ds.size}px`,
                    // transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Preview type={ev.type} value={ev.val} />
                </div>
              );
            }
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default App;
