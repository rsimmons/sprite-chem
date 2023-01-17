import { invariant, nextSeqNum } from "./util";
import { applyInvSTXform, applySTXform, pointInRect, Rect, STXform, Vec2, vec2add, vec2dist, vec2len, vec2lerp, vec2scale, vec2sub } from "./vec";

import witch from './sprites/witch.png';
import monster from './sprites/monster.png';
import { InitWorldState, RunningWorldState } from "./world";
import { Kind } from "./kind";
import { Sprite, spriteFromURL } from "./sprite";
import { analyzeRules, applyAnalyzedRules, AVAILABLE_RULE_SCHEMAS, ParsedRule, ParsedRuleItem, PARSED_SCHEMAS, RuleArg, RuleGlobalInputs, RuleInstance, RuleSchema } from "./rule";
import { createWorldIface, RuleWorldEffects } from "./ruleWorldIface";

export interface CodeState {
  readonly kinds: ReadonlyMap<number, Kind>;
  readonly rules: Map<number, RuleInstance>;
  readonly initWorldState: InitWorldState;
}

export type TouchPos = Vec2;
export type TouchRegion =
  {
    readonly type: 'canvas';
  } | {
    readonly type: 'rules';
  } | {
    readonly type: 'ruleParam';
    readonly ruleId: number;
    readonly paramIdx: number;
  } | {
    readonly type: 'other';
  };

type DragState =
  {
    // when kind-sprite has started being dragged, but has not yet "detached"
    readonly type: 'fromKindPalette';
    readonly touchId: TouchID;
    readonly kindId: number;
    readonly startPos: TouchPos;
    pos: TouchPos;
    readonly size: number;
    readonly offset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
  } | {
    readonly type: 'placingKind';
    readonly touchId: TouchID;
    readonly kindId: number;
    pos: TouchPos;
    size: number;
    readonly offset: Vec2; // relative to [-0.5, -0.5] to [0.5, 0.5] enclosing square
    sizingToWorldview: boolean; // sprite has gone over worldview, so matching its final size
  } | {
    readonly type: 'onCanvasEditBg';
    readonly touchId: TouchID;
    prevPos: TouchPos;
  } | {
    readonly type: 'placingRuleSchema';
    readonly touchId: TouchID;
    readonly schemaId: string;
    pos: TouchPos;
    readonly offset: Vec2; // screen pixels relative to top-left corner
  } | {
    readonly type: 'onCanvasRunningBg';
    readonly touchId: TouchID;
    pos: TouchPos;
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
  running: undefined | {
    worldState: RunningWorldState;
  };
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
    readonly region: TouchRegion;
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
  } | {
    readonly type: 'touchStartRulePalette';
    readonly touchId: TouchID;
    readonly pos: TouchPos;
    readonly schemaId: string;
    readonly offset: Vec2;
  } | {
    readonly type: 'touchEndRules';
    readonly touchId: TouchID;
    readonly pos: TouchPos;
  } | {
    readonly type: 'setRuleArgNumber';
    readonly ruleId: number;
    readonly paramIdx: number;
    readonly val: number;
  } | {
    readonly type: 'toggleRunning';
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
      initWorldState: {
        objects: new Map(),
      },
    },
    running: undefined,
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

      if (state.running) {
        const anRules = analyzeRules([...state.codeState.rules.values()]);
        const eff: RuleWorldEffects = {
          objMoveEffs: new Map(),
          objsRemoved: new Set(),
        };
        const rwi = createWorldIface(state.running.worldState, eff);

        const worldCanvasXform = getWorldCanvasXform(uist);
        const touchPoints: Array<Vec2> = [];
        for (const ds of uist.dragStates) {
          if (ds.type === 'onCanvasRunningBg') {
            touchPoints.push(applyInvSTXform(worldCanvasXform, applyInvSTXform(uist.canvasParams.canvasScreenXform, ds.pos)));
          }
        }
        const globalInputs: RuleGlobalInputs = {
          touchPoints,
        };

        applyAnalyzedRules(anRules, rwi, globalInputs);

        // apply effects generated by rules
        for (const [objId, ome] of eff.objMoveEffs) {
          switch (ome.type) {
            case 'towardPos': {
              const obj = state.running.worldState.objects.get(objId);
              invariant(obj);
              const diff = vec2sub(ome.pos, obj.pos);
              const dist = vec2len(diff);
              const maxDist = ome.speed*action.dt;
              if (dist <= maxDist) {
                obj.pos = ome.pos;
              } else {
                const move = vec2scale(diff, maxDist/dist);
                obj.pos = vec2add(obj.pos, move);
              }
              break;
            }
          }
        }
        for (const objId of eff.objsRemoved) {
          state.running.worldState.objects.delete(objId);
        }
        // end apply effects

        state.running.worldState.worldTime += action.dt;
      }

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

        case 'onCanvasEditBg': {
          const bgDrags = state.uiState.dragStates.filter(s => (s.type === 'onCanvasEditBg'));

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
            invariant(dragA.type === 'onCanvasEditBg');
            invariant(dragB.type === 'onCanvasEditBg');

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

        case 'placingRuleSchema': {
          ds.pos = action.pos;
          break;
        }

        case 'onCanvasRunningBg': {
          ds.pos = action.pos;
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
          if (action.region.type === 'canvas') {
            const worldCanvasXform = getWorldCanvasXform(uist);
            const kind = state.codeState.kinds.get(ds.kindId)!;
            const size = getKindInitialSize(kind);
            const worldPos = vec2sub(applyInvSTXform(worldCanvasXform, applyInvSTXform(uist.canvasParams.canvasScreenXform, ds.pos)), vec2scale(ds.offset, size));
            const oid = nextSeqNum();
            state.codeState.initWorldState.objects.set(oid, {
              id: oid,
              kind,
              pos: worldPos,
              size,
            });
          } else if (action.region.type === 'ruleParam') {
            const rule = state.codeState.rules.get(action.region.ruleId);
            invariant(rule);

            const schema = AVAILABLE_RULE_SCHEMAS.get(rule.schemaId)!;
            if (schema.params[action.region.paramIdx].type === 'kind') {
              rule.args[action.region.paramIdx] = {type: 'kind', kindId: ds.kindId};
            }
          }
          removeDragState(ds);
          break;
        }

        case 'onCanvasEditBg':
          removeDragState(ds);
          break;

        case 'placingRuleSchema':
          if ((action.region.type === 'rules') || (action.region.type === 'ruleParam')) {
            const schema = AVAILABLE_RULE_SCHEMAS.get(ds.schemaId)!;
            state.codeState.rules.set(nextSeqNum(), {
              schemaId: ds.schemaId,
              args: schema.params.map(param => {
                switch (param.type) {
                  case 'kind':
                    return undefined;

                  case 'number':
                    return {type: 'number', val: param.defaultVal};
                }
              }),
            });
          }
          removeDragState(ds);
          break;

        case 'onCanvasRunningBg':
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
      if (state.running) {
        uist.dragStates.push({
          type: 'onCanvasRunningBg',
          touchId: action.touchId,
          pos: action.pos,
        });
      } else {
        const hit = canvasHitTest(touchCanvasPos, state.uiState.canvasHitTargets);
        if (hit) {
          const objects = state.codeState.initWorldState.objects;
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
            type: 'onCanvasEditBg',
            touchId: action.touchId,
            prevPos: action.pos,
          });
        }
      }
      break;
    }

    case 'touchStartRulePalette': {
      uist.dragStates.push({
        type: 'placingRuleSchema',
        touchId: action.touchId,
        schemaId: action.schemaId,
        pos: action.pos,
        offset: action.offset,
      });
      break;
    }

    case 'setRuleArgNumber': {
      const rule = state.codeState.rules.get(action.ruleId);
      invariant(rule);
      invariant(action.paramIdx < rule.args.length);
      const param = rule.args[action.paramIdx];
      invariant(param);
      invariant(param.type === 'number');
      param.val = action.val;
      break;
    }

    case 'toggleRunning': {
      if (state.running) {
        state.running = undefined;
      } else {
        state.running = {
          worldState: {
            worldTime: 0,
            objects: new Map([...state.codeState.initWorldState.objects.entries()].map(([objId, obj]) => {
              const newId = nextSeqNum();
              return [newId, {
                id: newId,
                kind: obj.kind,
                pos: obj.pos,
                size: obj.size,
              }];
            })),
          },
        };
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

export function renderCanvas(state: AppState, canvas: HTMLCanvasElement) {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const ctx = canvas.getContext("2d");
  invariant(ctx);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const newHitTargets: Array<WorldviewHitTarget> = [];

  const objects = state.running ? state.running.worldState.objects : state.codeState.initWorldState.objects;

  const worldCanvasXform = getWorldCanvasXform(state.uiState);
  objects.forEach((obj, objId) => {
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
