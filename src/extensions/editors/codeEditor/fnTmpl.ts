import { invariant } from "../../../util";

export type ParsedTmplLineItem =
  {
    readonly type: 'text';
    readonly text: string;
  } | {
    readonly type: 'param';
    readonly pid: string;
    readonly label: string;
  };

export interface ParsedTmpl {
  readonly lines: ReadonlyArray<ReadonlyArray<ParsedTmplLineItem>>;
}

const TMPL_TEXT_PARAM_RE = /\{(?<pid>.*?)\|(?<label>.*?)\}/g;

export function parseFnTmplText(text: string): ParsedTmpl {
  const lines = text.trim().split('\n');
  const resultLines: Array<Array<ParsedTmplLineItem>> = [];

  for (let i = 0; i < lines.length; i++) {
    const resultLine: Array<ParsedTmplLineItem> = [];
    const line = lines[i].trim();

    const matches = line.matchAll(TMPL_TEXT_PARAM_RE);
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
        pid: match.groups['pid'],
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
