import React, { useEffect, useReducer, useRef, useState } from 'react';

import PoolTabPanel from './PoolTabPanel';
import { PointerID, AttachedDragData } from './extlib/common';
import { ClientXY, invariant } from './util';
import { DragState, INIT_STATE, reducer } from './newState';
import EditorContainer from './EditorContainer';
import PreviewerContainer from './PreviewerContainer';
import { Vec2, vec2scale, vec2sub } from './vec';
import { TEMPLATE } from './config';
import './NewApp.css';

import witch from './sprites/witch.png';
import monster from './sprites/monster.png';
import cyclops from './sprites/cyclops.png';

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

  const handlePointerMoveUp = (e: PointerEvent, type: 'pointerMove'|'pointerUp') => {
    dispatch({
      type,
      pointerId: e.pointerId,
      pos: {
        x: e.clientX,
        y: e.clientY,
      },
    });
  }
  const handlePointerMove = (e: PointerEvent) => {
    handlePointerMoveUp(e, 'pointerMove');
  };
  const handlePointerUp = (e: PointerEvent) => {
    handlePointerMoveUp(e, 'pointerUp');
  };

  const attachDragData = (pointerId: PointerID, e: any): void => {
    const matchDragStates = state.dragStates.filter(s => (s.pointerId === pointerId));
    if (matchDragStates.length === 1) {
      const ds = matchDragStates[0];
      const ev = state.evs.get(ds.evId);
      invariant(ev);
      const dd: AttachedDragData = {
        evId: ds.evId,
        type: ev.type,
        value: ev.val,
        size: ds.size,
        offset: ds.offset,
      };
      e.draggingEV = dd;
    } else {
      invariant(matchDragStates.length === 0);
    }
  };
  const handlePointerMoveCapture = (e: PointerEvent) => {
    attachDragData(e.pointerId, e);
  };
  const handlePointerUpCapture = (e: PointerEvent) => {
    attachDragData(e.pointerId, e);
  };

  useEffect(() => {
   window.addEventListener('pointermove', handlePointerMove, false);
   window.addEventListener('pointerup', handlePointerUp, false);
   window.addEventListener('pointermove', handlePointerMoveCapture, true);
   window.addEventListener('pointerup', handlePointerUpCapture, true);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, false);
      window.removeEventListener('pointerup', handlePointerUp, false);
      window.removeEventListener('pointermove', handlePointerMoveCapture, true);
      window.removeEventListener('pointerup', handlePointerUpCapture, true);
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

  const [activeTabId, setActiveTabId] = useState(TEMPLATE.tabs[0].tabId);

  const stoppedEditorEVId = state.singles.get(TEMPLATE.outputPanel.stoppedEditor.globalId);
  invariant(stoppedEditorEVId);

  return (
    <div className="App">
      <div className="App-output-rest">
        <div className="App-header">
          <div className="App-tab-links">{TEMPLATE.tabs.map(tab => {
            return <a key={tab.tabId} className={'App-tab-link ' + ((tab.tabId === activeTabId) ? 'App-tab-link-active' : 'App-tab-link-inactive')} href="#tab" onClick={(e) => handleTabLinkClick(e, tab.tabId)}>{tab.name}</a>
          })}</div>
          <div className="App-run-controls">
            <button onClick={handleRunningToggleClick}>
              {state.running ? 'Edit' : 'Run'}
            </button>
          </div>
        </div>
        <div className="App-tab-area">{TEMPLATE.tabs.map(tab => {
          return (
            <div key={tab.tabId} className={'App-tab-container ' + ((tab.tabId === activeTabId) ? 'App-tab-container-active' : 'App-tab-container-inactive')}>{
              (() => {
                switch (tab.kind) {
                  case 'empty':
                    return null;

                  case 'pool': {
                    const pool = TEMPLATE.pools.find(p => (p.globalId === tab.globalId));
                    invariant(pool);
                    return <PoolTabPanel globalId={pool.globalId} state={state} dispatch={dispatch} />
                  }
                }

              })()
            }</div>
          );
        })}
        </div>
      </div>
      <div className="App-output-area">
        {state.running ? (
          <div>runner output</div>
        ) : (
          <EditorContainer
            evId={stoppedEditorEVId}
            state={state}
            dispatch={dispatch}
          />
        )}
      </div>
      <div className="App-drags">
        {state.dragStates.map(ds => {
          switch (ds.type) {
            case 'draggingEV': {
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
                  }}
                >
                  <PreviewerContainer evId={ds.evId} state={state} />
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
