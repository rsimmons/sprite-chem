import { RuleWorldIface } from "./ruleWorldIface";
import { invariant } from "./util";
import { Vec2, vec2dist } from "./vec";

type RuleParam =
  {
    readonly type: 'kind';
  } | {
    readonly type: 'number';
    readonly defaultVal: number;
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

export type RuleArg =
  {
    readonly type: 'kind';
    kindId: number;
  } | {
    readonly type: 'number';
    val: number;
  };

interface RuleGlobalInputs {
  readonly touchPoints: ReadonlyArray<Vec2>;
}

export interface RuleSchema {
  readonly text: string;
  readonly params: ReadonlyArray<RuleParam>;
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
      {type: 'number', defaultVal: 1},
    ],
    getIO: (args) => {
      invariant(args[0].type === 'kind');
      const kindId = args[0].kindId;

      return {
        inputs: [
          {type: 'kindPositions', kindId},
          {type: 'touchPositions'},
        ],
        outputs: [
          {type: 'kindMoveTowardPosition', kindId},
        ],
      };
    },
    apply: (args, worldIface, globalInputs) => {
      if (globalInputs.touchPoints.length === 0) {
        return;
      }

      invariant(args[0].type === 'kind');
      const kindId = args[0].kindId;
      invariant(args[1].type === 'number');
      const speed = args[1].val;

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
      invariant(args[0].type === 'kind');
      const kindAId = args[0].kindId;
      invariant(args[1].type === 'kind');
      const kindBId = args[1].kindId;

      return {
        inputs: [
          {type: 'kindPositions', kindId: kindAId},
          {type: 'kindPositions', kindId: kindBId},
        ],
        outputs: [
          {type: 'kindRemove', kindId: kindAId},
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
  readonly args: Array<RuleArg | undefined>;
}

export interface ValidatedRuleInstance {
  readonly schemaId: string;
  readonly args: Array<RuleArg>;
}

export interface RulesAnalysis {
  readonly sortedRules: ReadonlyArray<ValidatedRuleInstance>;
}

export function analyzeRules(rules: ReadonlyArray<RuleInstance>): RulesAnalysis {
  // TODO: topological sort, etc.
  const sortedRules: Array<ValidatedRuleInstance> = [];
  for (const rule of rules) {
    if (rule.args.every(arg => (arg !== undefined))) {
      sortedRules.push({
        schemaId: rule.schemaId,
        args: rule.args as Array<RuleArg>,
      });
    }
  }

  return {
    sortedRules,
  };
}

export function applyAnalyzedRules(rules: RulesAnalysis, worldIface: RuleWorldIface, globalInputs: RuleGlobalInputs): void {
  for (const rule of rules.sortedRules) {
    const schema = AVAILABLE_RULE_SCHEMAS.get(rule.schemaId);
    invariant(schema);
    schema.apply(rule.args, worldIface, globalInputs);
  }
}
