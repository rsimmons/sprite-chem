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

  const pointRelativeToCanvas = (clientX: number, clientY: number): Vec2 => {
    invariant(canvasRef.current);
    const pixelScale = pixelScaleRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = pixelScale*(clientX - rect.left);
    const y = pixelScale*(clientY - rect.top);
    return {x, y};
  }

  const pointFromMouseEvent = (e: React.MouseEvent | MouseEvent): Vec2 => {
    return pointRelativeToCanvas(e.clientX, e.clientY);
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    updateAppState(stateRef.current, {
      type: 'mouseDown',
      pos: pointFromMouseEvent(e),
    });
  };

  const onWindowMouseUp = (e: MouseEvent) => {
    e.preventDefault();

    updateAppState(stateRef.current, {
      type: 'mouseUp',
      pos: pointFromMouseEvent(e),
    });
  };

  const onWindowMouseMove = (e: MouseEvent) => {
    e.preventDefault();

    updateAppState(stateRef.current, {
      type: 'mouseMove',
      pos: pointFromMouseEvent(e),
    });
  };

  useEffect(() => {
    window.addEventListener('mouseup', onWindowMouseUp, false);
    window.addEventListener('mousemove', onWindowMouseMove, false);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseUp, false);
      window.removeEventListener('mousemove', onWindowMouseMove, false);
    };
  });

  const onCanvasWheel = (e: React.WheelEvent) => {
    updateAppState(stateRef.current, {
      type: 'wheel',
      pos: pointFromMouseEvent(e),
      deltaY: e.deltaY,
    });
  };

  const onCanvasTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      updateAppState(stateRef.current, {
        type: 'touchStart',
        id: touch.identifier,
        pos: pointRelativeToCanvas(touch.clientX, touch.clientY),
      });
    }
  };

  const onCanvasTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      updateAppState(stateRef.current, {
        type: 'touchMove',
        id: touch.identifier,
        pos: pointRelativeToCanvas(touch.clientX, touch.clientY),
      });
    }
  };

  const onCanvasTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      updateAppState(stateRef.current, {
        type: 'touchEnd',
        id: touch.identifier,
        pos: pointRelativeToCanvas(touch.clientX, touch.clientY),
      });
    }
  };

  return (
    <div className="App">
      <canvas
        id="main-canvas"
        ref={canvasRef}
        onMouseDown={onCanvasMouseDown}
        onWheel={onCanvasWheel}
        onTouchStart={onCanvasTouchStart}
        onTouchMove={onCanvasTouchMove}
        onTouchEnd={onCanvasTouchEnd}
      ></canvas>
    </div>
  );
}

export default App;
