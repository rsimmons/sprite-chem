import React, { useEffect, useRef, useState } from 'react';

import PoolTabPanel from './PoolTabPanel';
import { BeginDragEVArgs, BeginDragValueArgs, DragInfo, PointerEventData, PointerID } from './extlib/editor';
import { invariant } from './util';
import { AppAction, AppStateOrLoading, createInitState, reducer } from './state';
import EditorContainer from './EditorContainer';
import PreviewerContainer from './PreviewerContainer';
import RunnerContainer from './RunnerContainer';
import { Vec2, vec2sub } from './vec';
import { TEMPLATE } from './config';
import { useEffectfulReducer, useRunOnce } from './useEffectfulReducer';
import './App.css';

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

  const handleBeginDragValue = (args: BeginDragValueArgs) => {
    dispatch({
      type: 'beginDragValue',
      ...args,
    });

    dispatchDragMove(args.pointerId, args.pos);
  };

  const handleBeginDragEV = (args: BeginDragEVArgs) => {
    dispatch({
      type: 'beginDragEV',
      ...args,
    });

    dispatchDragMove(args.pointerId, args.pos);
  };

  const pointerEventTarget = useRef(new EventTarget());
  const dispatchDragEvent  = (type: 'dragMove' | 'dragDrop', pointerId: number, pos: Vec2, dragInfo: DragInfo): boolean => {
    const ed: PointerEventData = {
      pointerId: pointerId,
      pos,
      dragInfo,
    };
    const pe = new CustomEvent(type, {
      detail: ed,
      cancelable: true,
    });
    return pointerEventTarget.current.dispatchEvent(pe);
  };

  const dispatchDragMove = (pointerId: PointerID, pos: Vec2): void => {
    const dragInfo = createDragInfo(pointerId);
    if (dragInfo) {
      const accepted = !dispatchDragEvent('dragMove', pointerId, pos, dragInfo);
      if (accepted) {
        dispatch({
          type: 'acceptDrag',
          pointerId: pointerId,
        });
      }
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (state === 'loading') {
      return;
    }

    const pos = {
      x: e.clientX,
      y: e.clientY,
    };

    dispatch({
      type: 'pointerMove',
      pointerId: e.pointerId,
      pos,
    });

    dispatchDragMove(e.pointerId, pos);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (state === 'loading') {
      return;
    }

    const pos = {
      x: e.clientX,
      y: e.clientY,
    };

    const dragInfo = createDragInfo(e.pointerId);
    if (dragInfo) {
      dispatchDragEvent('dragDrop', e.pointerId, pos, dragInfo);
    }

    dispatch({
      type: 'pointerUp',
      pointerId: e.pointerId,
      pos,
    });
  };

  const createDragInfo = (pointerId: PointerID): DragInfo | undefined => {
    const curState = stateRef.current;
    invariant(curState !== 'loading');
    const matchDragStates = curState.dragStates.filter(s => (s.pointerId === pointerId));
    if (matchDragStates.length === 1) {
      const ds = matchDragStates[0];

      let payload: DragInfo['payload'];
      switch (ds.payload.type) {
        case 'ev': {
          payload = {
            type: 'ev',
            ev: ds.payload.ev,
          };
          break;
        }

        case 'value': {
          payload = {
            type: 'value',
            typeId: ds.payload.typeId,
            value: ds.payload.value,
          };
          break;
        }

        default:
          throw new Error('unhandled drag state payload type');
      }

      const di: DragInfo = {
        dragId: ds.dragId,
        payload,
        dims: ds.dims,
        offset: ds.offset,
      };
      return di;
    } else {
      invariant(matchDragStates.length === 0);
      return undefined;
    }
  };

  useEffect(() => {
   window.addEventListener('pointermove', handlePointerMove, false);
   window.addEventListener('pointerup', handlePointerUp, false);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, false);
      window.removeEventListener('pointerup', handlePointerUp, false);
    };
  }, [handlePointerMove, handlePointerUp]);

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
                          return (
                            <PoolTabPanel
                              globalId={pool.globalId}
                              state={state}
                              pointerEventTarget={pointerEventTarget.current}
                              onBeginDragEV={handleBeginDragEV}
                              onBeginDragValue={handleBeginDragValue}
                            />
                          );
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
                  pointerEventTarget={pointerEventTarget.current}
                  onBeginDragValue={handleBeginDragValue}
                />
              )}
            </div>
            <div className="App-drags">
              {state.dragStates.map(ds => {
                const adjPos = vec2sub(ds.pos, ds.offset);

                const className = 'App-drag ' + (ds.accepted ? 'App-drag-accepted' : 'App-drag-rejected');

                switch (ds.payload.type) {
                  case 'ev': {
                    return (
                      <div
                        className={className}
                        key={ds.dragId}
                        style={{
                          position: 'absolute',
                          left: adjPos.x,
                          top: adjPos.y,
                          width: `${ds.dims.x}px`,
                          height: `${ds.dims.y}px`,
                        }}
                      >
                        <PreviewerContainer ev={ds.payload.ev} />
                      </div>
                    );
                  }

                  case 'value': {
                    return (
                      <div
                        className={className}
                        key={ds.dragId}
                        style={{
                          position: 'absolute',
                          left: adjPos.x,
                          top: adjPos.y,
                        }}
                      >
                        {ds.payload.previewElem && (
                          <WrappedDOMNode node={ds.payload.previewElem} />
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
