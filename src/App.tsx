import React, { useEffect, useRef } from 'react';

import { invariant } from './util';
import { initAppState, renderAppState, updateAppState, AppState, TouchPos, Action } from './state';
import { useEffectfulReducer } from './useEffectfulReducer';
import './App.css';
import { STXform, Vec2, vec2scale, vec2sub } from './vec';

function App() {
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

  const [state, dispatch] = useEffectfulReducer((s: AppState, a: Action, d) => {
    updateAppState(s, a);
    return {
      ...s, // to defeat issue where setState doesn't re-render unless arg has changed
    }
  }, () => initAppState());

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

    renderAppState(state, canvas);
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
  }

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    dispatch({
      type: 'touchStartCanvas',
      touchId: 'mouse',
      pos: getTouchPos(e),
    });
  };
  const onCanvasTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      dispatch({
        type: 'touchStartCanvas',
        touchId: touch.identifier,
        pos: getTouchPos(touch),
      });
    }
  };

  const onKindPaletteItemMouseDown = (e: React.MouseEvent, kindId: number) => {
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
  const onKindPaletteItemTouchStart = (e: React.TouchEvent, kindId: number) => {
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

  const onWindowMouseMove = (e: MouseEvent) => {
    e.preventDefault();

    dispatch({
      type: 'touchMove',
      touchId: 'mouse',
      pos: getTouchPos(e),
    });
  };

  const onWindowMouseUp = (e: MouseEvent) => {
    e.preventDefault();

    dispatch({
      type: 'touchEnd',
      touchId: 'mouse',
      pos: getTouchPos(e),
    });
  };

  const onWindowTouchMove = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      dispatch({
        type: 'touchMove',
        touchId: touch.identifier,
        pos: getTouchPos(touch),
      });
    }
  };

  const onWindowTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      dispatch({
        type: 'touchEnd',
        touchId: touch.identifier,
        pos: getTouchPos(touch),
      });
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', onWindowMouseMove, false);
    window.addEventListener('mouseup', onWindowMouseUp, false);
    window.addEventListener('touchmove', onWindowTouchMove, false);
    window.addEventListener('touchend', onWindowTouchEnd, false);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove, false);
      window.removeEventListener('mouseup', onWindowMouseUp, false);
      window.removeEventListener('touchmove', onWindowTouchMove, false);
      window.removeEventListener('touchend', onWindowTouchEnd, false);
    };
  });

  const onCanvasWheel = (e: React.WheelEvent) => {
    dispatch({
      type: 'wheel',
      pos: getTouchPos(e),
      deltaY: e.deltaY,
    });
  };

  return (
    <div className="App">
      <div className="App-rule-palette" />
      <div className="App-rule-palette-rest">
        <div className="App-kind-palette-rest">
          <div className="App-rules" />
          <div className="App-worldview-container">
            <canvas
              className="App-worldview-canvas"
              ref={canvasRef}
              onMouseDown={onCanvasMouseDown}
              onTouchStart={onCanvasTouchStart}
              onWheel={onCanvasWheel}
            />
          </div>
        </div>
        <div className="App-kind-palette">
          {[...state.codeState.kinds.entries()].map(([kindId, kind]) =>
            <img
              src={kind.sprite.url}
              key={kindId}
              onMouseDown={e => onKindPaletteItemMouseDown(e, kindId)}
              onTouchStart={e => onKindPaletteItemTouchStart(e, kindId)}
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
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default App;
