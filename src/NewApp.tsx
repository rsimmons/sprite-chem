import React, { useEffect, useState } from 'react';

import PoolTabPanel from './PoolTabPanel';
import { DragInfo, PointerID } from './extlib/editor';
import { ClientXY, invariant } from './util';
import { AppAction, AppStateOrLoading, DragState, createInitState, reducer } from './newState';
import EditorContainer from './EditorContainer';
import PreviewerContainer from './PreviewerContainer';
import RunnerContainer from './RunnerContainer';
import { Vec2, vec2scale, vec2sub } from './vec';
import { TEMPLATE } from './config';
import { useEffectfulReducer, useRunOnce } from './useEffectfulReducer';
import './NewApp.css';

const WrappedDOMNode: React.FC<{node: HTMLElement}> = ({node}) => {
  return (
    <div className="WrappedDOMNode" ref={nodeRef => {
      if (nodeRef) {
        nodeRef.appendChild(node);
      }
    }} />
  );
}

const App: React.FC = () => {
  const [stateRef, dispatch] = useEffectfulReducer<AppStateOrLoading, AppAction>(reducer, () => 'loading');
  const state = stateRef.current;

  useRunOnce(() => {
    (async () => {
      dispatch({
        type: 'load',
        state: await createInitState(),
      });
    })();
  });

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
    invariant(state !== 'loading');
    const matchDragStates = state.dragStates.filter(s => (s.pointerId === pointerId));
    if (matchDragStates.length === 1) {
      const ds = matchDragStates[0];
      switch (ds.type) {
        case 'detachingEV':
        case 'draggingEV': {
          const di: DragInfo = {
            dragId: ds.dragId,
            payload: {
              type: 'ev',
              ev: ds.ev,
            },
            width: ds.size,
            height: ds.size,
            offset: ds.offset,
          };
          e.dragInfo = di;
          break;
        }

        case 'draggingValue': {
          const di: DragInfo = {
            dragId: ds.dragId,
            payload: {
              type: 'value',
              typeId: ds.typeId,
              value: ds.value,
            },
            width: 0, // TODO: set these
            height: 0,
            offset: ds.offset,
          };
          e.dragInfo = di;
          break;
        }

        default:
          throw new Error('unhandled drag state type');
      }
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

  return (
    <div className="App">
      {(state === 'loading') ? (
        <div className="App-loading">Loading...</div>
      ) : ((() => {
        const stoppedEditorEV = state.singles.get(TEMPLATE.outputPanel.stoppedEditor.globalId);
        invariant(stoppedEditorEV);

        return (
          <>
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
                <RunnerContainer
                  state={state}
                  dispatch={dispatch}
                />
              ) : (
                <EditorContainer
                  ev={stoppedEditorEV}
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
                        <PreviewerContainer ev={ds.ev} />
                      </div>
                    );
                  }

                  case 'draggingValue': {
                    const adjPos = vec2sub(ds.pos, ds.offset);
                    return (
                      <div
                        key={ds.pointerId}
                        style={{
                          position: 'absolute',
                          left: adjPos.x,
                          top: adjPos.y,
                        }}
                      >
                        {ds.node && (
                          <WrappedDOMNode node={ds.node} />
                        )}
                      </div>
                    );
                  }
                }
                return null;
              })}
            </div>
          </>
        );
      })())}
    </div>
  );
};

export default App;
