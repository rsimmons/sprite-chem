import { RuleWorldIface } from "./ruleWorldIface";
import { invariant } from "./util";
import { Vec2, vec2dist } from "./vec";

type RuleParamType =
  {
    readonly type: 'kind';
    // argument is passed as kindId number
  } | {
    readonly type: 'number';
    // argument is passed as number
  };

type RuleInput =
  {
    readonly type: 'touchPositions';
  } | {
    readonly type: 'kindPositions';
    readonly kindId: number;
  };

type RuleOutput =
  {
    readonly type: 'kindMoveTowardPosition';
    readonly kindId: number;
  } | {
    readonly type: 'kindSize';
    readonly kindId: number;
  } | {
    readonly type: 'kindRemove';
    readonly kindId: number;
  };

interface RuleInputsOutputs {
  readonly inputs: ReadonlyArray<RuleInput>;
  readonly outputs: ReadonlyArray<RuleOutput>;
}

export type RuleArg = any;

interface RuleGlobalInputs {
  readonly touchPoints: ReadonlyArray<Vec2>;
}

export interface RuleSchema {
  readonly text: string;
  readonly params: ReadonlyArray<RuleParamType>;
  readonly getIO: (args: ReadonlyArray<RuleArg>) => RuleInputsOutputs;
  readonly apply: (args: ReadonlyArray<RuleArg>, worldIface: RuleWorldIface, globalInputs: RuleGlobalInputs) => void;
}

type RuleSchemaID = string;

const RULE_TEXT_PARAM_RE = /\{(?<idx>[0-9]+)\|(?<label>.*?)\}/g;

export type ParsedRuleItem =
  {
    readonly type: 'text';
    readonly text: string;
  } | {
    readonly type: 'param';
    readonly idx: number;
    readonly label: string;
  };

export interface ParsedRule {
  readonly lines: ReadonlyArray<ReadonlyArray<ParsedRuleItem>>;
}

export function parseRuleSchemaText(text: string): ParsedRule {
  const lines = text.trim().split('\n');
  const resultLines: Array<Array<ParsedRuleItem>> = [];

  for (let i = 0; i < lines.length; i++) {
    const resultLine: Array<ParsedRuleItem> = [];
    const line = lines[i].trim();

    const matches = line.matchAll(RULE_TEXT_PARAM_RE);
    let idx = 0;
    for (const match of matches) {
      invariant(match.index !== undefined);
      invariant(match.groups !== undefined);
      const matchLen = match[0].length;

      if (match.index > idx) {
        // there was text before this param
        resultLine.push({
          type: 'text',
          text: line.substring(idx, match.index).trim(),
        });
      }

      resultLine.push({
        type: 'param',
        idx: +match.groups['idx'],
        label: match.groups['label'],
      });

      idx = match.index + matchLen;
    }

    if (idx < line.length) {
      // there was text after the last param
      resultLine.push({
        type: 'text',
        text: line.slice(idx).trim(),
      });
    }

    resultLines.push(resultLine);
  }

  return {
    lines: resultLines,
  };
}

export const AVAILABLE_RULE_SCHEMAS: ReadonlyMap<RuleSchemaID, RuleSchema> = new Map([
  ['kindMoveTowardNearestTouchAtSpeed', {
    text: '{0|A} moves toward nearest touch point\nat speed {1|S}',
    params: [
      {type: 'kind'},
      {type: 'number'},
    ],
    getIO: (args) => {
      return {
        inputs: [
          {type: 'kindPositions', kindId: args[0]},
          {type: 'touchPositions'},
        ],
        outputs: [
          {type: 'kindMoveTowardPosition', kindId: args[0]},
        ],
      };
    },
    apply: (args, worldIface, globalInputs) => {
      if (globalInputs.touchPoints.length === 0) {
        return;
      }

      const kindId = args[0] as number;
      const speed = args[1] as number;

      for (const obj of worldIface.iterObjectsByKindId(kindId)) {
        const objPos = worldIface.getObjectPosition(obj);

        let nearestDist = undefined;
        let nearestPos = undefined;
        for (const tp of globalInputs.touchPoints) {
          const dist = vec2dist(objPos, tp);
          if ((nearestDist === undefined) || (dist < nearestDist)) {
            nearestDist = dist;
            nearestPos = tp;
          }
        }
        invariant(nearestDist && nearestPos);

        worldIface.setObjectMoveTowardPosition(obj, nearestPos, speed);
      }
    },
  }],

  ['kindRemovedWhenTouchesKind', {
    text: '{0|A} is removed when it touches {1|B}',
    params: [
      {type: 'kind'},
      {type: 'kind'},
    ],
    getIO: (args) => {
      return {
        inputs: [
          {type: 'kindPositions', kindId: args[0]},
        ],
        outputs: [
          {type: 'kindRemove', kindId: args[0]},
        ],
      };
    },
    apply: (args, worldIface, globalInputs) => {
      throw new Error('unimplemented');
    },
  }],
]);

export const PARSED_SCHEMAS = new Map([...AVAILABLE_RULE_SCHEMAS.entries()].map(([schemaId, schema]) => [schemaId, parseRuleSchemaText(schema.text)]));

export interface RuleInstance {
  readonly schemaId: string;
  readonly args: ReadonlyArray<RuleArg>;
}

export interface RulesAnalysis {
  readonly sortedRules: ReadonlyArray<RuleInstance>;
}

export function analyzeRules(rules: ReadonlyArray<RuleInstance>): RulesAnalysis {
  // TODO: topological sort, etc.

  return {
    sortedRules: rules,
  };
}

export function applyAnalyzedRules(rules: RulesAnalysis, worldIface: RuleWorldIface, globalInputs: RuleGlobalInputs): void {
  for (const rule of rules.sortedRules) {
    const schema = AVAILABLE_RULE_SCHEMAS.get(rule.schemaId);
    invariant(schema);
    schema.apply(rule.args, worldIface, globalInputs);
  }
}
