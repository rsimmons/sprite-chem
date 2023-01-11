import { invariant } from "./util";
import { pointInRect, Rect, Vec2, vec2add, vec2dist, vec2scale, vec2sub } from "./vec";

import witch from './sprites/witch.png';
import monster from './sprites/monster.png';
import { addObject, WorldState } from "./world";
import { Kind } from "./kind";
import { Sprite, spriteFromURL } from "./sprite";
import { AVAILABLE_RULE_SCHEMAS, ParsedRule, ParsedRuleItem, PARSED_SCHEMAS, RuleArg, RuleInstance, RuleSchema } from "./rule";

interface CodeState {
  readonly nextKindId: number;
  readonly kinds: ReadonlyMap<number, Kind>;

  readonly nextRuleId: number;
  readonly rules: ReadonlyMap<number, RuleInstance>;
}

interface PanelRects {
  rulePalette: Rect;
  kindPalette: Rect;
  viewport: Rect;
}

type DragState =
  {
    type: 'fromKindPalette',
    inputId: 'mouse' | number,
    kindId: number;
    startPos: Vec2;
    pos: Vec2;
    size: number;
    spriteOffset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
    detached: boolean;
    sizingToViewport: boolean; // sprite has gone over viewport, so matching its final size
  } | {
    type: 'fromViewportBg',
    inputId: 'mouse' | number,
    prevPos: Vec2;
  } | {
    type: 'fromViewportObj',
    inputId: 'mouse' | number,
    kindId: number;
    pos: Vec2;
    size: number;
    spriteOffset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
  };

type HitEntity =
  {
    type: 'paletteKind';
    kindId: number;
    pos: Vec2;
    size: number;
  } | {
    type: 'viewportBg';
  } | {
    type: 'viewportObj';
    objId: number;
    pos: Vec2;
    size: number;
  };

interface HitTarget {
  rect: Rect;
  entity: HitEntity;
}

interface ViewportState {
  center: Vec2; // world-coordinates point that is centered in viewport
  fitRadius: number; // radius of world-space circle to fit in viewport
}

interface UIState {
  canvasDims: Vec2;
  panelRects: PanelRects;
  dragStates: Array<DragState>;
  hitTargets: Array<HitTarget>;
  viewportState: ViewportState;
}

export interface AppState {
  appTime: number;
  uiState: UIState;
  codeState: CodeState;
  worldState: WorldState;
}

function addKind(codeState: CodeState, sprite: Sprite): CodeState {
  const id = codeState.nextKindId;
  const newKinds = new Map(codeState.kinds);
  newKinds.set(id, {
    id,
    sprite,
  });

  return {
    ...codeState,
    nextKindId: codeState.nextKindId+1,
    kinds: newKinds,
  };
}

function getKindInitialSize(kind: Kind) {
  return 1;
}

export type Action =
  {
    readonly type: 'advanceTime';
    readonly dt: number;
  } | {
    readonly type: 'setCanvasDims';
    readonly width: number;
    readonly height: number;
  } | {
    readonly type: 'mouseDown';
    readonly pos: Vec2;
  } | {
    readonly type: 'mouseUp';
    readonly pos: Vec2;
  } | {
    readonly type: 'mouseMove';
    readonly pos: Vec2;
  } | {
    readonly type: 'wheel';
    readonly pos: Vec2;
    readonly deltaY: number;
  } | {
    readonly type: 'touchStart';
    readonly id: number;
    readonly pos: Vec2;
  } | {
    readonly type: 'touchMove';
    readonly id: number;
    readonly pos: Vec2;
  } | {
    readonly type: 'touchEnd';
    readonly id: number;
    readonly pos: Vec2;
  };

function computePanelRects(canvasDims: Vec2): PanelRects {
  const rulePaletteRight = Math.round(0.25*canvasDims.x);
  const rulesRight = Math.round(0.5*canvasDims.x);
  const viewportBottom = Math.round(0.875*canvasDims.y);

  return {
    rulePalette: {
      left: 0,
      top: 0,
      width: rulePaletteRight,
      height: canvasDims.y,
    },
    kindPalette: {
      left: rulePaletteRight,
      top: viewportBottom,
      width: canvasDims.x - rulePaletteRight,
      height: canvasDims.y - viewportBottom,
    },
    viewport: {
      left: rulesRight,
      top: 0,
      width: canvasDims.x - rulesRight,
      height: viewportBottom,
    },
  }
}

export function initAppState(): AppState {
  const canvasDims: Vec2 = {
    x: 1600,
    y: 900,
  };


  const state: AppState = {
    appTime: 0,
    uiState: {
      canvasDims,
      panelRects: computePanelRects(canvasDims),
      dragStates: [],
      hitTargets: [],
      viewportState: {
        center: {x: 0, y: 0},
        fitRadius: 5,
      },
    },
    codeState: {
      nextKindId: 1,
      kinds: new Map(),
      nextRuleId: 1,
      rules: new Map(),
    },
    worldState: {
      worldTime: 0,
      nextObjectId: 1,
      objects: new Map(),
    },
  };

  addKindFromSpriteURL(state, witch);
  addKindFromSpriteURL(state, monster);

  return state;
}

async function addKindFromSpriteURL(state: AppState, url: string) {
  const sprite = spriteFromURL(url);
  state.codeState = addKind(state.codeState, sprite);
}

function hitTest(p: Vec2, hitTargets: Array<HitTarget>): HitTarget | undefined {
  for (let i = hitTargets.length-1; i >= 0; i--) {
    const ht = hitTargets[i];
    if (pointInRect(p, ht.rect)) {
      return ht;
    }
  }

  return undefined;
}

// scale before translate
interface NoRotXform {
  s: number;
  tx: number;
  ty: number;
}

function applyXform(xform: NoRotXform, p: Vec2): Vec2 {
  return {
    x: xform.s*p.x + xform.tx,
    y: xform.s*p.y + xform.ty,
  };
}

interface CanvasWorldXforms {
  worldToCanvas: NoRotXform;
  canvasToWorld: NoRotXform;
}

function getCanvasWorldXforms(uiState: UIState): CanvasWorldXforms {
  const viewportRect = uiState.panelRects.viewport;
  const canvasPerWorld = Math.min(viewportRect.width, viewportRect.height) / (2*uiState.viewportState.fitRadius);
  const center = uiState.viewportState.center;

  const worldToCanvas: NoRotXform = {
    s: canvasPerWorld,
    tx: viewportRect.left + 0.5*viewportRect.width - canvasPerWorld*center.x,
    ty: viewportRect.top + 0.5*viewportRect.height - canvasPerWorld*center.y,
  };

  const worldPerCanvas = 1.0/canvasPerWorld;
  const canvasToWorld: NoRotXform = {
    s: worldPerCanvas,
    tx: -worldPerCanvas*worldToCanvas.tx,
    ty: -worldPerCanvas*worldToCanvas.ty,
  };

  return {
    worldToCanvas,
    canvasToWorld,
  };
}

export function updateAppState(state: AppState, action: Action): void {
  const findMatchingDragState = (action: Action): DragState | undefined => {
    const uist = state.uiState;

    if ((action.type === 'mouseMove') || (action.type === 'mouseUp')) {
      const mouseDragStates = uist.dragStates.filter(s => (s.inputId === 'mouse'));
      if (mouseDragStates.length === 1) {
        return mouseDragStates[0];
      } else {
        invariant(mouseDragStates.length === 0);
        return undefined;
      }
    } else if ((action.type === 'touchMove') || (action.type === 'touchEnd')) {
      const matchDragStates = uist.dragStates.filter(s => (s.inputId === action.id));
      invariant(matchDragStates.length === 1, 'must have exactly 1 matching touch drag state');
      return matchDragStates[0];
    } else {
      invariant(false);
    }
  }

  switch (action.type) {
    case 'advanceTime': {
      state.appTime += action.dt;

      const uist = state.uiState;
      for (const ds of uist.dragStates) {
        switch (ds.type) {
          case 'fromKindPalette': {
            if (ds.sizingToViewport) {
              const xforms = getCanvasWorldXforms(uist);
              const kind = state.codeState.kinds.get(ds.kindId)!;
              const targetSize = xforms.worldToCanvas.s*getKindInitialSize(kind);
              if (ds.size !== targetSize) {
                const RESCALE_RATE = 5;
                const rescaleAmt = RESCALE_RATE*action.dt;
                const logCurSize = Math.log(ds.size);
                const logTargetSize = Math.log(targetSize);
                const diffLogSize = logTargetSize - logCurSize;
                if (Math.abs(diffLogSize) < rescaleAmt) {
                  ds.size = targetSize;
                } else {
                  const logNewSize = logCurSize + Math.sign(diffLogSize)*rescaleAmt;
                  ds.size = Math.exp(logNewSize);
                }
              }
            }
            break;
          }
        }
      }
      break;
    }

    case 'setCanvasDims': {
      state.uiState.canvasDims = {
        x: action.width,
        y: action.height,
      };
      state.uiState.panelRects = computePanelRects(state.uiState.canvasDims);
      break;
    }

    case 'mouseDown':
    case 'touchStart': {
      const uist = state.uiState;

      let inputId: 'mouse' | number;
      if (action.type === 'mouseDown') {
        const mouseDragStates = uist.dragStates.filter(s => (s.inputId === 'mouse'));
        invariant(mouseDragStates.length === 0, 'mouseDown received when there are already mouse drag states');
        inputId = 'mouse';
      } else if (action.type === 'touchStart') {
        inputId = action.id;
      } else {
        invariant(false);
      }

      const hit = hitTest(action.pos, state.uiState.hitTargets);
      if (hit) {
        switch (hit.entity.type) {
          case 'paletteKind':
            uist.dragStates.push({
              type: 'fromKindPalette',
              inputId,
              kindId: hit.entity.kindId,
              startPos: action.pos,
              pos: action.pos,
              size: hit.entity.size,
              spriteOffset: vec2scale(vec2sub(action.pos, hit.entity.pos), 1/hit.entity.size),
              detached: false,
              sizingToViewport: false,
            });
            break;

          case 'viewportBg':
            uist.dragStates.push({
              type: 'fromViewportBg',
              inputId,
              prevPos: action.pos,
            });
            break;

          case 'viewportObj': {
            const objects = state.worldState.objects;
            const objId = hit.entity.objId;
            const obj = objects.get(objId)!;
            const kindId = obj.kind.id;
            objects.delete(objId);

            uist.dragStates.push({
              type: 'fromViewportObj',
              inputId,
              kindId,
              pos: action.pos,
              size: hit.entity.size,
              spriteOffset: vec2scale(vec2sub(action.pos, hit.entity.pos), 1/hit.entity.size),
            });
            break;
          }
        }
      }
      break;
    }

    case 'mouseUp':
    case 'touchEnd': {
      const uist = state.uiState;
      const ds = findMatchingDragState(action);
      if (!ds) {
        break;
      }

      switch (ds.type) {
        case 'fromKindPalette':
        case 'fromViewportObj': {
          if (pointInRect(ds.pos, uist.panelRects.viewport)) {
            const xforms = getCanvasWorldXforms(uist);
            const kind = state.codeState.kinds.get(ds.kindId)!;
            const size = getKindInitialSize(kind);
            const worldPos = vec2sub(applyXform(xforms.canvasToWorld, ds.pos), vec2scale(ds.spriteOffset, size));
            addObject(state.worldState, kind, worldPos, size);
          }
          uist.dragStates = uist.dragStates.filter(s => (s !== ds));
          break;
        }

        case 'fromViewportBg':
          uist.dragStates = uist.dragStates.filter(s => (s !== ds));
          break;
      }
      break;
    }

    case 'mouseMove':
    case 'touchMove': {
      const uist = state.uiState;
      const ds = findMatchingDragState(action);
      if (!ds) {
        break;
      }

      switch (ds.type) {
        case 'fromKindPalette':
        case 'fromViewportObj': {
          ds.pos = action.pos;

          if (ds.type === 'fromKindPalette') {
            if (!ds.detached) {
              if ((ds.pos.y - ds.startPos.y) < -25) {
                ds.detached = true;
              }
            }

            if (!ds.sizingToViewport) {
              if (pointInRect(ds.pos, uist.panelRects.viewport)) {
                ds.sizingToViewport = true;
              }
            }
          }

          break;
        }

        case 'fromViewportBg': {
          const canvasDelta = vec2sub(ds.prevPos, action.pos);
          const xforms = getCanvasWorldXforms(uist);
          const worldDelta = vec2scale(canvasDelta, xforms.canvasToWorld.s);
          ds.prevPos = action.pos;
          uist.viewportState.center = vec2add(uist.viewportState.center, worldDelta);
          break;
        }
      }

      break;
    }

    case 'wheel': {
      const uist = state.uiState;
      if (pointInRect(action.pos, uist.panelRects.viewport)) {
        uist.viewportState.fitRadius *= Math.exp(0.001*action.deltaY);
      }
      break;
    }
  }
}

function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, pos: Vec2, size: number): Rect {
  switch (sprite.data.type) {
    case 'loaded': {
      const imgd = sprite.data;
      const width = size*imgd.scaledWidth;
      const height = size*imgd.scaledHeight;
      const left = pos.x - 0.5*width;
      const top = pos.y - 0.5*height;
      ctx.drawImage(imgd.bitmap, left, top, width, height);
      return {
        left,
        top,
        width,
        height,
      };
    }

    case 'loading':
      // TODO: draw placeholder box with x?
      return {
        left: pos.x - 0.5*size,
        top: pos.y - 0.5*size,
        width: size,
        height: size,
      };
  }
}

type RuleLayoutItem =
  {
    readonly type: 'text';
    readonly x: number;
    readonly y: number;
  } | {
    readonly type: 'kindParam';
    readonly x: number;
    readonly y: number;
    readonly size: number;
  };

interface RuleLayout {
  readonly items: ReadonlyArray<RuleLayoutItem>;
  readonly width: number;
  readonly height: number;
}

// we assume ctx.textBaseline = 'top'
function layoutRule(ctx: CanvasRenderingContext2D, ruleSchema: RuleSchema, parsed: ParsedRule, args: ReadonlyArray<RuleArg | undefined>): RuleLayout {
  const resultItems: Array<RuleLayoutItem> = [];
  const MIN_LINE_HEIGHT = 20; // this should be based on measuring font, but hardcode for now
  const KIND_ARG_SIZE = 50;

  for (const line of parsed.lines) {

  }
}

// we assume ctx.textBaseline = 'top'
function renderRule(ctx: CanvasRenderingContext2D, ruleSchema: RuleSchema, parsed: ReadonlyArray<ParsedRuleItem>, pos: Vec2, args: ReadonlyArray<RuleArg | undefined>): number {
  const HPAD = 20;
  const VPAD = 15;
  const HSPACE = 15;
  const VSPACE = 15;
  const KIND_ARG_SIZE = 50;
  const LINE_HEIGHT = KIND_ARG_SIZE;

  let xoff = HPAD;
  let yoff = VPAD;
  let lineWidth = 0;
  let xidx = 0;
  let boxWidth = 0;
  for (const item of parsed) {
    switch (item.type) {
      case 'text': {
        if (xidx > 0) {
          xoff += HSPACE;
        }
        const meas = ctx.measureText(item.text);
        const height = meas.fontBoundingBoxDescent;
        ctx.fillText(item.text, pos.x+xoff, pos.y+yoff+0.5*(LINE_HEIGHT-height));
        xoff += meas.width;
        lineWidth = xoff;
        xidx++;
        break;
      }

      case 'param': {
        if (xidx > 0) {
          xoff += HSPACE;
        }
        ctx.strokeRect(pos.x+xoff, pos.y+yoff, KIND_ARG_SIZE, KIND_ARG_SIZE);
        xoff += KIND_ARG_SIZE;
        lineWidth = xoff;
        xidx++;
        break;
      }

      case 'break': {
        lineWidth += HPAD;
        invariant(lineWidth > 0);
        boxWidth = Math.max(boxWidth, lineWidth);

        xoff = HPAD;
        yoff += LINE_HEIGHT + VSPACE;
        lineWidth = 0;
        xidx = 0;
        break;
      }
    }
  }

  lineWidth += HPAD;
  invariant(lineWidth > 0);
  boxWidth = Math.max(boxWidth, lineWidth);

  const boxHeight = yoff + LINE_HEIGHT + VPAD;

  ctx.strokeRect(pos.x, pos.y, boxWidth, boxHeight);

  return boxHeight;
}

export function renderAppState(state: AppState, canvas: HTMLCanvasElement) {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const ctx = canvas.getContext("2d");
  invariant(ctx);

  ctx.textBaseline = 'top';
  ctx.font = '32px sans-serif';

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const panelRects = state.uiState.panelRects;

  const rulePaletteRect = panelRects.rulePalette;
  const kindPaletteRect = panelRects.kindPalette;
  const viewportRect = panelRects.viewport;

  /**
   * PANEL BORDERS
   */

  ctx.strokeStyle = '#888';

  ctx.beginPath();
  ctx.moveTo(rulePaletteRect.left+rulePaletteRect.width, rulePaletteRect.top);
  ctx.lineTo(rulePaletteRect.left+rulePaletteRect.width, rulePaletteRect.top+rulePaletteRect.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(kindPaletteRect.left, kindPaletteRect.top);
  ctx.lineTo(kindPaletteRect.left+kindPaletteRect.width, kindPaletteRect.top);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(viewportRect.left, viewportRect.top);
  ctx.lineTo(viewportRect.left, viewportRect.top+viewportRect.height);
  ctx.stroke();

  const newHitTargets: Array<HitTarget> = [];

  /**
   * RULE SCHEMAS
   */
  const RULE_SCHEMA_SPACING = 20;
  const RULE_SCHEMA_TOP_MARGIN = 20;
  const RULE_SCHEMA_LEFT_MARGIN = 20;
  let y = RULE_SCHEMA_TOP_MARGIN;
  for (const [schemaId, schema] of AVAILABLE_RULE_SCHEMAS.entries()) {
    const pos = {
      x: RULE_SCHEMA_LEFT_MARGIN,
      y,
    };
    const args = schema.params.map(p => undefined);
    y += renderRule(ctx, schema, PARSED_SCHEMAS.get(schemaId)!, pos, args);
    y += RULE_SCHEMA_SPACING;
  }

  /**
   * KIND PALETTE
   */
  let i = 0;
  state.codeState.kinds.forEach((kind, id) => {
    const pos = {
      x: kindPaletteRect.left + (i + 0.5)*kindPaletteRect.height,
      y: kindPaletteRect.top + 0.5*kindPaletteRect.height,
    };
    const size = 0.9*kindPaletteRect.height;
    const rect = drawSprite(ctx, kind.sprite, pos, size);
    newHitTargets.push({
      rect,
      entity: {
        type: 'paletteKind',
        kindId: id,
        pos,
        size,
      },
    });
    i++;
  });

  /**
   * VIEWPORT
   */
  ctx.save();

  // clip to the viewport
  ctx.beginPath();
  ctx.rect(viewportRect.left, viewportRect.top, viewportRect.width, viewportRect.height);
  ctx.clip();

  newHitTargets.push({
    rect: viewportRect,
    entity: {
      type: 'viewportBg',
    },
  });

  const xforms = getCanvasWorldXforms(state.uiState);
  state.worldState.objects.forEach((obj, objId) => {
    const pos = applyXform(xforms.worldToCanvas, obj.pos);
    const size = xforms.worldToCanvas.s*obj.size;
    const rect = drawSprite(ctx, obj.kind.sprite, pos, size);
    newHitTargets.push({
      rect,
      entity: {
        type: 'viewportObj',
        objId,
        pos,
        size,
      },
    });
  });
  ctx.restore();

  /**
   * DRAGGED ITEMS
   */
  ctx.globalAlpha = 0.5;
  for (const ds of state.uiState.dragStates) {
    switch (ds.type) {
      case 'fromKindPalette':
      case 'fromViewportObj': {
        if ((ds.type === 'fromKindPalette') && !ds.detached) {
          break;
        }
        const sprite = state.codeState.kinds.get(ds.kindId)!.sprite;
        drawSprite(ctx, sprite, vec2sub(ds.pos, vec2scale(ds.spriteOffset, ds.size)), ds.size);
        break;
      }
    }
  }
  ctx.globalAlpha = 1;

  state.uiState.hitTargets = newHitTargets;

  // sanity check that we have canvas dims correct
  ctx.fillRect(canvasWidth-15, canvasHeight-15, 10, 10);
}
