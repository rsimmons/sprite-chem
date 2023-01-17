import React, { useEffect, useRef } from 'react';

import { invariant } from './util';
import { initAppState, renderCanvas, updateAppState, AppState, Action, TouchRegion, CodeState } from './state';
import { useEffectfulReducer } from './useEffectfulReducer';
import { Vec2, vec2scale, vec2sub } from './vec';
import { AVAILABLE_RULE_SCHEMAS, PARSED_SCHEMAS, RuleArg, RuleSchema } from './rule';
import './App.css';

const Rule: React.FC<{
  schemaId: string,
  schema: RuleSchema,
  ruleId?: number,
  args?: ReadonlyArray<RuleArg | undefined>,
  onMouseDown: React.MouseEventHandler<HTMLElement>,
  onTouchStart: React.TouchEventHandler<HTMLElement>,
  dispatch?: (action: Action) => void,
  codeState: CodeState,
}> = ({schemaId, schema, ruleId, args, onMouseDown, onTouchStart, dispatch, codeState}) => {
  const parsed = PARSED_SCHEMAS.get(schemaId)!;

  return (
    <div
      className="Rule"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {parsed.lines.map((line, lineIdx) => {
        return (
          <div key={lineIdx} className="Rule-line">
            {line.map((item, itemIdx) => {
              switch (item.type) {
                case 'text':
                  return <div key={itemIdx}>{item.text}</div>;

                case 'param': {
                  const paramIdx = item.idx;
                  const param = schema.params[paramIdx];

                  switch (param.type) {
                    case 'kind': {
                      if ((args === undefined) || (args[paramIdx] === undefined)) {
                        return (
                          <div
                            key={itemIdx}
                            className={'Rule-param-kind-empty' + ((args !== undefined) ? ' Rule-param-kind-needed' : '')}
                            data-region={ruleId ? `ruleParam-${ruleId}-${paramIdx}` : null}
                          >
                            {item.label}
                          </div>
                        );
                      } else {
                        const arg = args[paramIdx];
                        invariant(arg && (arg.type === 'kind'));
                        const kind = codeState.kinds.get(arg.kindId);
                        invariant(kind);
                        return (
                          <div
                            key={itemIdx}
                            className="Rule-param-kind-filled"
                            data-region={ruleId ? `ruleParam-${ruleId}-${paramIdx}` : null}
                          >
                            <img
                              src={kind.sprite.url}
                            />
                          </div>
                        );
                      }
                    }

                    case 'number': {
                      if (args === undefined) {
                        return (
                          <div
                            key={itemIdx}
                            className="Rule-param-number-empty"
                          >
                            {item.label}
                          </div>
                        );
                      } else {
                        const arg = args[paramIdx];
                        invariant(arg && (arg.type === 'number'));
                        invariant(ruleId);
                        invariant(dispatch);

                        const handleChange = ((e: React.ChangeEvent<HTMLInputElement>) => {
                          dispatch({
                            type: 'setRuleArgNumber',
                            ruleId,
                            paramIdx,
                            val: +e.currentTarget.value,
                          });
                        });

                        return (
                          <input
                            key={itemIdx}
                            className="Rule-param-number-filled"
                            type="number"
                            value={arg.val}
                            onChange={handleChange}
                          />
                        );
                      }
                    }
                  }
                }
              }
            })}
          </div>
        );
      })}
    </div>
  );
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pixelScaleRef = useRef(1);

  const sizeCanvas = (canvas: HTMLCanvasElement) => {
    const USE_HIDPI = true;
    const pixelScale = USE_HIDPI ? window.devicePixelRatio : 1;
    pixelScaleRef.current = pixelScale;

    invariant(canvas.parentElement);
    const containerWidth = canvas.parentElement.clientWidth;
    const containerHeight = canvas.parentElement.clientHeight;

    const canvasWidth = pixelScale*containerWidth;
    const canvasHeight = pixelScale*containerHeight;

    // only do resize if necessary
    if ((canvas.width !== canvasWidth) || (canvas.height !== canvasHeight)) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;
    }
  };

  const [stateRef, dispatch] = useEffectfulReducer((s: AppState, a: Action, d) => {
    updateAppState(s, a);
    return {
      ...s, // to defeat issue where setState doesn't re-render unless arg has changed
    }
  }, () => initAppState());
  const state = stateRef.current;

  const render = (dt: number): void => {
    dispatch({
      type: 'advanceTime',
      dt,
    });

    if (!canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;

    sizeCanvas(canvas);

    const canvasRect = canvas.getBoundingClientRect();

    dispatch({
      type: 'setCanvasParams',
      width: canvas.width,
      height: canvas.height,
      canvasScreenXform: {
        s: 1/pixelScaleRef.current,
        tx: canvasRect.left,
        ty: canvasRect.top,
      },
    });

    renderCanvas(stateRef.current, canvas);
  };

  const rafRef = useRef<number | undefined>();
  const prevTimeRef = useRef<number | undefined>();

  const frameCallback = (time: number) => {
    let deltaTime = 0;
    if (prevTimeRef.current !== undefined) {
      deltaTime = time - prevTimeRef.current;
    }
    prevTimeRef.current = time;

    render(0.001*deltaTime);

    rafRef.current = requestAnimationFrame(frameCallback);
  }

  useEffect(() => {
    rafRef.current = requestAnimationFrame(frameCallback);

    return () => {
      cancelAnimationFrame(rafRef.current!);
    };

    // doing this "properly" makes code unnecessarily messy
    // eslint-disable-next-line
  }, []);

  interface ClientPos {
    readonly clientX: number;
    readonly clientY: number;
  }

  const getTouchPos = (clientPos: ClientPos): Vec2 => {
    return {
      x: clientPos.clientX,
      y: clientPos.clientY,
    }
  };

  const getRegion = (e: ClientPos): TouchRegion => {
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    if (elem) {
      let n: Node | null = elem;
      while (n) {
        if ((n instanceof HTMLElement) && (n.dataset.region)) {
          const regionStr = n.dataset.region!;
          const regionParts = regionStr.split('-');

          switch (regionParts[0]) {
            case 'canvas':
              return {type: 'canvas'};

            case 'rules':
              return {type: 'rules'};

            case 'ruleParam':
              invariant(regionParts.length === 3);
              return {
                type: 'ruleParam',
                ruleId: +regionParts[1],
                paramIdx: +regionParts[2],
              };

            default:
              invariant(false);
          }
        }
        n = n.parentNode;
      }
      return {type: 'other'};
    } else {
      return {type: 'other'};
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    dispatch({
      type: 'touchStartCanvas',
      touchId: 'mouse',
      pos: getTouchPos(e),
    });
  };
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      dispatch({
        type: 'touchStartCanvas',
        touchId: touch.identifier,
        pos: getTouchPos(touch),
      });
    }
  };

  const handleKindPaletteItemMouseDown = (e: React.MouseEvent, kindId: number) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const maxDim = Math.max(rect.width, rect.height);

    dispatch({
      type: 'touchStartKindPalette',
      touchId: 'mouse',
      pos: getTouchPos(e),
      kindId,
      size: maxDim,
      offset: {
        x: (e.clientX - 0.5*(rect.left + rect.right))/maxDim,
        y: (e.clientY - 0.5*(rect.top + rect.bottom))/maxDim,
      },
    });
  };
  const handleKindPaletteItemTouchStart = (e: React.TouchEvent, kindId: number) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      const rect = e.currentTarget.getBoundingClientRect();
      const maxDim = Math.max(rect.width, rect.height);

      dispatch({
        type: 'touchStartKindPalette',
        touchId: touch.identifier,
        pos: getTouchPos(touch),
        kindId,
        size: maxDim,
        offset: {
          x: (touch.clientX - 0.5*(rect.left + rect.right))/maxDim,
          y: (touch.clientY - 0.5*(rect.top + rect.bottom))/maxDim,
        },
      });
    }
  };

  const handleRulePaletteMouseDown = (e: React.MouseEvent, schemaId: string) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();

    dispatch({
      type: 'touchStartRulePalette',
      touchId: 'mouse',
      pos: getTouchPos(e),
      schemaId,
      offset: {
        x: (e.clientX - rect.left),
        y: (e.clientY - rect.top),
      },
    });
  };
  const handleRulePaletteTouchStart = (e: React.TouchEvent, schemaId: string) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      const rect = e.currentTarget.getBoundingClientRect();

      dispatch({
        type: 'touchStartRulePalette',
        touchId: touch.identifier,
        pos: getTouchPos(touch),
        schemaId,
        offset: {
          x: (touch.clientX - rect.left),
          y: (touch.clientY - rect.top),
        },
      });
    }
  };

  const handleWindowMouseMove = (e: MouseEvent) => {
    e.preventDefault();

    dispatch({
      type: 'touchMove',
      touchId: 'mouse',
      pos: getTouchPos(e),
    });
  };
  const handleWindowTouchMove = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      dispatch({
        type: 'touchMove',
        touchId: touch.identifier,
        pos: getTouchPos(touch),
      });
    }
  };

  const handleWindowMouseUp = (e: MouseEvent) => {
    e.preventDefault();

    dispatch({
      type: 'touchEnd',
      touchId: 'mouse',
      pos: getTouchPos(e),
      region: getRegion(e),
    });
  };
  const handleWindowTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      dispatch({
        type: 'touchEnd',
        touchId: touch.identifier,
        pos: getTouchPos(touch),
        region: getRegion(touch),
      });
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

  const handleCanvasWheel = (e: React.WheelEvent) => {
    dispatch({
      type: 'wheel',
      pos: getTouchPos(e),
      deltaY: e.deltaY,
    });
  };

  const handleRunningToggleClick = (e: React.MouseEvent) => {
    dispatch({
      type: 'toggleRunning',
    });
  };

  return (
    <div className="App">
      <div className="App-rule-palette">
        {[...AVAILABLE_RULE_SCHEMAS.entries()].map(([schemaId, schema]) => {
          return <Rule
            key={schemaId}
            schemaId={schemaId}
            schema={schema}
            onMouseDown={e => handleRulePaletteMouseDown(e, schemaId)}
            onTouchStart={e => handleRulePaletteTouchStart(e, schemaId)}
            codeState={state.codeState}
          />
        })}
      </div>
      <div className="App-rule-palette-rest">
        <div className="App-kind-palette-rest">
          <div className="App-rules" data-region="rules">
            {[...state.codeState.rules.entries()].map(([ruleId, rule]) => {
              const schema = AVAILABLE_RULE_SCHEMAS.get(rule.schemaId)!;

              return <Rule
                key={ruleId}
                schemaId={rule.schemaId}
                schema={schema}
                ruleId={ruleId}
                args={rule.args}
                onMouseDown={e => {}}
                onTouchStart={e => {}}
                // onMouseDown={e => handleRuleMouseDown(e, ruleId)}
                // onTouchStart={e => handleRuleTouchStart(e, ruleId)}
                dispatch={dispatch}
                codeState={state.codeState}
              />
            })}
          </div>
          <div className="App-rules-rest">
            <div className="App-world-controls">
              <button onClick={handleRunningToggleClick}>
                {state.running ? 'Edit' : 'Run'}
              </button>
            </div>
            <div className="App-worldview-container">
              <canvas
                className="App-worldview-canvas"
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onTouchStart={handleCanvasTouchStart}
                onWheel={handleCanvasWheel}
                data-region="canvas"
              />
            </div>
          </div>
        </div>
        <div className="App-kind-palette">
          {[...state.codeState.kinds.entries()].map(([kindId, kind]) =>
            <img
              src={kind.sprite.url}
              key={kindId}
              onMouseDown={e => handleKindPaletteItemMouseDown(e, kindId)}
              onTouchStart={e => handleKindPaletteItemTouchStart(e, kindId)}
            />
          )}
        </div>
      </div>
      <div className="App-drags">
        {state.uiState.dragStates.map(ds => {
          switch (ds.type) {
            case 'placingKind': {
              const kind = state.codeState.kinds.get(ds.kindId)!;
              const adjPos = vec2sub(ds.pos, vec2scale(ds.offset, ds.size));
              return <img key={ds.touchId} src={kind.sprite.url} style={{
                position: 'absolute',
                left: adjPos.x,
                top: adjPos.y,
                maxWidth: `${ds.size}px`,
                maxHeight: `${ds.size}px`,
                transform: 'translate(-50%, -50%)',
              }} />
            }

            case 'placingRuleSchema': {
              const schema = AVAILABLE_RULE_SCHEMAS.get(ds.schemaId)!;
              return (
                <div
                  key={ds.schemaId}
                  style={{
                    position: 'absolute',
                    left: ds.pos.x - ds.offset.x,
                    top: ds.pos.y - ds.offset.y,
                  }}
                >
                  <Rule
                    schemaId={ds.schemaId}
                    schema={schema}
                    onMouseDown={e => handleRulePaletteMouseDown(e, ds.schemaId)}
                    onTouchStart={e => handleRulePaletteTouchStart(e, ds.schemaId)}
                    codeState={state.codeState}
                    />
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
