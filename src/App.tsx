import React, { useEffect, useRef } from 'react';

import { invariant } from './util';
import { initAppState, renderAppState, updateAppState, AppState } from './state';
import './App.css';
import { Vec2 } from './vec';

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

  const stateRef = useRef<AppState>(initAppState());

  const render = (dt: number): void => {
    const state = stateRef.current;
    updateAppState(state, {
      type: 'advanceTime',
      dt,
    });

    if (!canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;

    sizeCanvas(canvas);

    updateAppState(state, {
      type: 'setCanvasDims',
      width: canvas.width,
      height: canvas.height,
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

  const pointFromEvent = (e: React.MouseEvent): Vec2 => {
    const pixelScale = pixelScaleRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = pixelScale*(e.clientX - rect.left);
    const y = pixelScale*(e.clientY - rect.top);
    return {x, y};
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    updateAppState(stateRef.current, {
      type: 'mouseDown',
      pos: pointFromEvent(e),
    });
  };

  const onCanvasMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();

    updateAppState(stateRef.current, {
      type: 'mouseUp',
      pos: pointFromEvent(e),
    });
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();

    updateAppState(stateRef.current, {
      type: 'mouseMove',
      pos: pointFromEvent(e),
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    updateAppState(stateRef.current, {
      type: 'wheel',
      pos: pointFromEvent(e),
      deltaY: e.deltaY,
    });
  };

  return (
    <div className="App">
      <canvas
        id="main-canvas"
        ref={canvasRef}
        onMouseDown={onCanvasMouseDown}
        onMouseUp={onCanvasMouseUp}
        onMouseMove={onCanvasMouseMove}
        onWheel={onWheel}
      ></canvas>
    </div>
  );
}

export default App;
