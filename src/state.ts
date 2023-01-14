import { invariant, nextSeqNum } from "./util";
import { applyInvSTXform, applySTXform, pointInRect, Rect, STXform, Vec2, vec2add, vec2dist, vec2lerp, vec2scale, vec2sub } from "./vec";

import witch from './sprites/witch.png';
import monster from './sprites/monster.png';
import { addObject, WorldState } from "./world";
import { Kind } from "./kind";
import { Sprite, spriteFromURL } from "./sprite";
import { AVAILABLE_RULE_SCHEMAS, ParsedRule, ParsedRuleItem, PARSED_SCHEMAS, RuleArg, RuleInstance, RuleSchema } from "./rule";

interface CodeState {
  readonly kinds: ReadonlyMap<number, Kind>;
  readonly rules: ReadonlyMap<number, RuleInstance>;
}

export type TouchPos = Vec2;

type DragState =
  {
    // when kind-sprite has started being dragged, but has not yet "detached"
    readonly type: 'fromKindPalette',
    readonly touchId: TouchID,
    readonly kindId: number;
    readonly startPos: TouchPos;
    pos: TouchPos;
    readonly size: number;
    readonly offset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
  } | {
    readonly type: 'placingKind',
    readonly touchId: TouchID,
    readonly kindId: number;
    pos: TouchPos;
    size: number;
    readonly offset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
    sizingToWorldview: boolean; // sprite has gone over worldview, so matching its final size
  } | {
    readonly type: 'fromWorldviewBg',
    readonly touchId: TouchID,
    prevPos: Vec2;
  };

interface WorldviewHitTarget {
  readonly rect: Rect;
  readonly objId: number;
}

interface WorldviewState {
  center: Vec2; // world-coordinates point that is centered in worldview
  fitRadius: number; // radius of world-space circle to fit in worldview
}

interface UIState {
  canvasParams: {
    width: number;
    height: number;
    canvasScreenXform: STXform;
  };
  dragStates: Array<DragState>;
  canvasHitTargets: Array<WorldviewHitTarget>;
  worldviewState: WorldviewState;
}

export interface AppState {
  appTime: number;
  uiState: UIState;
  codeState: CodeState;
  worldState: WorldState;
}

function addKind(codeState: CodeState, sprite: Sprite): CodeState {
  const id = nextSeqNum();
  const newKinds = new Map(codeState.kinds);
  newKinds.set(id, {
    id,
    sprite,
  });

  return {
    ...codeState,
    kinds: newKinds,
  };
}

function getKindInitialSize(kind: Kind) {
  return 1;
}

export type TouchID = number | 'mouse';

export type Action =
  {
    readonly type: 'advanceTime';
    readonly dt: number;
  } | {
    readonly type: 'setCanvasParams';
    readonly width: number;
    readonly height: number;
    readonly canvasScreenXform: STXform;
  } | {
    readonly type: 'wheel';
    readonly pos: TouchPos;
    readonly deltaY: number;
  } | {
    readonly type: 'touchMove';
    readonly touchId: TouchID;
    readonly pos: TouchPos;
  } | {
    readonly type: 'touchEnd';
    readonly touchId: TouchID;
    readonly pos: TouchPos;
  } | {
    readonly type: 'touchStartKindPalette';
    readonly touchId: TouchID;
    readonly pos: TouchPos;
    readonly kindId: number;
    readonly size: number;
    readonly offset: Vec2;
  } | {
    readonly type: 'touchStartCanvas';
    readonly touchId: TouchID;
    readonly pos: TouchPos;
  };

export function initAppState(): AppState {
  const state: AppState = {
    appTime: 0,
    uiState: {
      canvasParams: {
        // all placeholder
        width: 1600,
        height: 900,
        canvasScreenXform: {
          s: 1,
          tx: 0,
          ty: 0,
        },
      },
      dragStates: [],
      canvasHitTargets: [],
      worldviewState: {
        center: {x: 0, y: 0},
        fitRadius: 5,
      },
    },
    codeState: {
      kinds: new Map(),
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

function canvasHitTest(p: Vec2, hitTargets: Array<WorldviewHitTarget>): WorldviewHitTarget | undefined {
  for (let i = hitTargets.length-1; i >= 0; i--) {
    const ht = hitTargets[i];
    if (pointInRect(p, ht.rect)) {
      return ht;
    }
  }

  return undefined;
}

function getWorldCanvasXform(uiState: UIState): STXform {
  const canvasWidth = uiState.canvasParams.width;
  const canvasHeight = uiState.canvasParams.height;
  const canvasPerWorld = Math.min(canvasWidth, canvasHeight) / (2*uiState.worldviewState.fitRadius);
  const center = uiState.worldviewState.center;

  return {
    s: canvasPerWorld,
    tx: 0.5*canvasWidth - canvasPerWorld*center.x,
    ty: 0.5*canvasHeight - canvasPerWorld*center.y,
  };
}

export function updateAppState(state: AppState, action: Action): void {
  const findMatchingDragState = (touchId: TouchID): DragState | undefined => {
    const matchDragStates = state.uiState.dragStates.filter(s => (s.touchId === touchId));
    if (matchDragStates.length === 1) {
      return matchDragStates[0];
    } else {
      invariant(matchDragStates.length === 0);
      return undefined;
    }
  };

  const removeDragState = (ds: DragState) => {
    uist.dragStates = uist.dragStates.filter(s => (s !== ds));
  };

  const touchPosInsideCanvas = (uiState: UIState, pos: TouchPos): boolean => {
    const canvasPos = applyInvSTXform(uiState.canvasParams.canvasScreenXform, pos);
    return (
      (canvasPos.x >= 0) &&
      (canvasPos.x < uiState.canvasParams.width) &&
      (canvasPos.y >= 0) &&
      (canvasPos.y <= uiState.canvasParams.height)
    );
  };

  const uist = state.uiState;

  switch (action.type) {
    case 'advanceTime': {
      state.appTime += action.dt;

      for (const ds of uist.dragStates) {
        switch (ds.type) {
          case 'placingKind': {
            if (ds.sizingToWorldview) {
              const worldCanvasXform = getWorldCanvasXform(uist);
              const kind = state.codeState.kinds.get(ds.kindId)!;
              const targetSize = worldCanvasXform.s*uist.canvasParams.canvasScreenXform.s*getKindInitialSize(kind);
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

    case 'setCanvasParams': {
      state.uiState.canvasParams = {
        width: action.width,
        height: action.height,
        canvasScreenXform: action.canvasScreenXform,
      };
      break;
    }

    case 'touchMove': {
      const ds = findMatchingDragState(action.touchId);
      if (!ds) {
        break;
      }

      switch (ds.type) {
        case 'fromKindPalette': {
          ds.pos = action.pos;
          if ((ds.pos.y - ds.startPos.y) < -15) {
            removeDragState(ds);
            uist.dragStates.push({
              type: 'placingKind',
              touchId: ds.touchId,
              kindId: ds.kindId,
              pos: ds.pos,
              size: ds.size,
              offset: ds.offset,
              sizingToWorldview: false,
            });
          }
          break;
        }

        case 'placingKind': {
          ds.pos = action.pos;
          if (touchPosInsideCanvas(uist, ds.pos)) {
            ds.sizingToWorldview = true;
          }
          break;
        }

        case 'fromWorldviewBg': {
          const bgDrags = state.uiState.dragStates.filter(s => (s.type === 'fromWorldviewBg'));

          invariant(bgDrags.length !== 0);
          if (bgDrags.length === 1) {
            invariant(bgDrags[0] === ds);
            const screenDelta = vec2sub(ds.prevPos, action.pos);
            const worldCanvasXform = getWorldCanvasXform(uist);
            const worldDelta = vec2scale(screenDelta, 1/(worldCanvasXform.s*uist.canvasParams.canvasScreenXform.s));
            uist.worldviewState.center = vec2add(uist.worldviewState.center, worldDelta);
          } else if (bgDrags.length === 2) {
            const dragA = bgDrags[0];
            const dragB = bgDrags[1];
            invariant(dragA.type === 'fromWorldviewBg');
            invariant(dragB.type === 'fromWorldviewBg');

            // change world->canvas mapping such that before point pair distance is mapped to after point pair distance,
            // and old midpoint is mapped to new midpoint
            const zoomTrans = (before: [Vec2, Vec2], after: [Vec2, Vec2]): void => {
              const beforeDist = vec2dist(before[0], before[1]);
              const afterDist = vec2dist(after[0], after[1]);
              if (afterDist !== 0) {
                const ratio = beforeDist/afterDist;

                const beforeMid = vec2lerp(before[0], before[1], 0.5);
                const afterMid = vec2lerp(after[0], after[1], 0.5);

                const worldCanvasXform = getWorldCanvasXform(uist);
                const beforeMidWorld = applyInvSTXform(worldCanvasXform, applyInvSTXform(uist.canvasParams.canvasScreenXform, beforeMid));
                const afterMidWorld = applyInvSTXform(worldCanvasXform, applyInvSTXform(uist.canvasParams.canvasScreenXform, afterMid));
                const worldDiff = vec2sub(afterMidWorld, beforeMidWorld);

                uist.worldviewState.fitRadius *= ratio;
                uist.worldviewState.center = vec2sub(uist.worldviewState.center, vec2scale(worldDiff, 1 /*TODO: figure out scale? pretty sure this needs to be related to ratio, but not clear how*/));
              }
            };

            if (dragA === ds) {
              zoomTrans([dragA.prevPos, dragB.prevPos], [action.pos, dragB.prevPos]);
            } else if (dragB === ds) {
              zoomTrans([dragA.prevPos, dragB.prevPos], [dragA.prevPos, action.pos]);
            } else {
              invariant(false);
            }
          }
          ds.prevPos = action.pos;
          break;
        }
      }

      break;
    }

    case 'touchEnd': {
      const ds = findMatchingDragState(action.touchId);
      if (!ds) {
        break;
      }

      switch (ds.type) {
        case 'fromKindPalette':
          removeDragState(ds);
          break;

        case 'placingKind': {
          if (touchPosInsideCanvas(uist, ds.pos)) {
            const worldCanvasXform = getWorldCanvasXform(uist);
            const kind = state.codeState.kinds.get(ds.kindId)!;
            const size = getKindInitialSize(kind);
            const worldPos = vec2sub(applyInvSTXform(worldCanvasXform, applyInvSTXform(uist.canvasParams.canvasScreenXform, ds.pos)), vec2scale(ds.offset, size));
            addObject(state.worldState, kind, worldPos, size);
          }
          removeDragState(ds);
          break;
        }

        case 'fromWorldviewBg':
          removeDragState(ds);
          break;
      }
      break;
    }

    case 'wheel': {
      uist.worldviewState.fitRadius *= Math.exp(0.001*action.deltaY);
      break;
    }

    case 'touchStartKindPalette': {
      uist.dragStates.push({
        type: 'fromKindPalette',
        touchId: action.touchId,
        kindId: action.kindId,
        startPos: action.pos,
        pos: action.pos,
        size: action.size,
        offset: action.offset,
      });
      break;
    }

    case 'touchStartCanvas': {
      const touchCanvasPos = applyInvSTXform(uist.canvasParams.canvasScreenXform, action.pos);
      const hit = canvasHitTest(touchCanvasPos, state.uiState.canvasHitTargets);
      if (hit) {
        const objects = state.worldState.objects;
        const objId = hit.objId;
        const obj = objects.get(objId)!;
        const kindId = obj.kind.id;
        objects.delete(objId);

        const worldCanvasXform = getWorldCanvasXform(uist);
        const canvasPos = applySTXform(worldCanvasXform, obj.pos);
        const canvasSize = worldCanvasXform.s*obj.size;
        const offset = vec2scale(vec2sub(touchCanvasPos, canvasPos), 1/canvasSize);

        const screenSize = uist.canvasParams.canvasScreenXform.s*canvasSize;

        uist.dragStates.push({
          type: 'placingKind',
          touchId: action.touchId,
          kindId,
          pos: action.pos,
          size: screenSize,
          offset,
          sizingToWorldview: true,
        });
      } else {
        uist.dragStates.push({
          type: 'fromWorldviewBg',
          touchId: action.touchId,
          prevPos: action.pos,
        });
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

/*
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
*/

export function renderAppState(state: AppState, canvas: HTMLCanvasElement) {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const ctx = canvas.getContext("2d");
  invariant(ctx);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  /**
   * RULE SCHEMAS
   */
  /*
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
  */

  const newHitTargets: Array<WorldviewHitTarget> = [];

  const worldCanvasXform = getWorldCanvasXform(state.uiState);
  state.worldState.objects.forEach((obj, objId) => {
    const pos = applySTXform(worldCanvasXform, obj.pos);
    const size = worldCanvasXform.s*obj.size;
    const rect = drawSprite(ctx, obj.kind.sprite, pos, size);
    newHitTargets.push({
      rect,
      objId,
    });
  });

  state.uiState.canvasHitTargets = newHitTargets;

  // sanity check that we have canvas dims correct
  ctx.fillRect(canvasWidth-15, canvasHeight-15, 10, 10);
}