import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Editor, EditorContext, DragInfo, DragPayload, PointerEventData } from '../../extlib/editor';
import { genUidRandom, insertIntoArray, invariant } from '../../util';
import { Vec2, vec2dist, vec2sub } from '../../vec';
import { ASTNode, Code, DeclNode, EqNode, FnAppNode, HoleNode, isBindExprNode, isDeclNode, isProgramNode, isValueExprNode, LiteralNode, Name, NodeId, ProgramNode, ValueExprNode, VarNameNode, VarRefNode } from '../types/code';
import './codeEditor.css';
import { EVWrapper } from '../../extlib/ev';
import { Previewer, PreviewerReturn } from '../../extlib/previewer';
import { useConstant } from '../../utilReact';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function pointInRect(p: Vec2, r: Rect): boolean {
  return ((p.x >= r.left) && (p.x < (r.left+r.width)) && (p.y > r.top) && (p.y < (r.top+r.height)));
}

function transformChildren<N extends ASTNode, X>(node: N, transform: (node: ASTNode, ctx: X) => ASTNode, ctx: X): N {
  // this could be factored out like transformNodeArr above
  const xChild = <C extends ASTNode>(n: C, pred: (n: ASTNode) => n is C): C => {
    const tn = transform(n, ctx);
    if (!pred(tn)) {
      throw new Error();
    }
    return tn;
  };

  const xChildArr = <C extends ASTNode>(arr: ReadonlyArray<C>, pred: (n: ASTNode) => n is C): ReadonlyArray<C> => {
    let changed = false;
    const newArr = arr.map(el => {
      const nel = transform(el, ctx);
      if (!pred(nel)) {
        throw new Error();
      }
      if (nel !== el) {
        changed = true;
      }
      return nel;
    });
    return changed ? newArr : arr;
  };

  // this could be factored out like transformNodeArr above
  const xChildMap = <C extends ASTNode>(map: ReadonlyMap<string, C>, pred: (n: ASTNode) => n is C): ReadonlyMap<string, C> => {
    let changed = false;
    const newMap = new Map<string, C>();
    for (const [k, v] of map.entries()) {
      const nv = transform(v, ctx);
      if (!pred(nv)) {
        throw new Error();
      }
      if (nv !== v) {
        changed = true;
      }
      newMap.set(k, nv);
    }
    return changed ? newMap : map;
  };

  switch (node.type) {
    case 'Hole':
    case 'Literal':
    case 'VarRef':
    case 'VarName':
      // no children
      return node;

    case 'FnApp': {
      const newArgs = xChildMap(node.args, isValueExprNode);

      if (newArgs === node.args) {
        return node;
      } else {
        return {
          ...node,
          args: newArgs,
        };
      }
    }

    case 'When':
      throw new Error('unimplemented');

    case 'Eq': {
      const newLHS = xChild(node.lhs, isBindExprNode);
      const newRHS = xChild(node.rhs, isValueExprNode);

      if ((newLHS === node.lhs) && (newRHS === node.rhs)) {
        return node;
      } else {
        return {
          ...node,
          lhs: newLHS,
          rhs: newRHS,
        };
      }
    }

    case 'Emit':
      throw new Error('unimplemented');

    case 'Program': {
      const newDecls = xChildArr(node.decls, isDeclNode);

      if (newDecls === node.decls) {
        return node;
      } else {
        return {
          ...node,
          decls: newDecls,
        };
      }
    }
  }
}

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

// the externally-visible (caller-visible) interface to a function. similar to a function-type
interface FnExtIface {
  readonly tmpl: string;
  readonly params: ReadonlyArray<{
    readonly pid: string;
    readonly type: Type;
  }>;
  // TODO: returned type(s)
}

type Type =
  | {type: 'Fn', iface: FnExtIface}
  | {type: 'Num'}
  | {type: 'Vec2'}
  | {type: 'EV', typeId: string}
  ;

interface Analysis {
  readonly type: Type;
}

function makeFnApp(nid: NodeId, fnNid: NodeId, fnIface: FnExtIface): ASTNode {
  return {
    type: 'FnApp',
    nid,
    fn: fnNid,
    args: new Map(fnIface.params.map((p, idx) =>
      [p.pid, {
        type: 'Hole',
        nid: `arg${idx}`,
      }],
    )),
  };
}

const Block: React.FC<{children?: React.ReactNode, node: ASTNode, ctx: NodeViewCtx, style: string, isListItem: boolean, allowed: string}> = ({children, node, ctx, style, isListItem, allowed}) => {
  const blockElem = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).tagName === 'INPUT') {
      return;
    }

    e.preventDefault();

    if (ctx.allowDrag === 'no') {
      return;
    }

    if (node.type === 'Hole') {
      return;
    }

    e.stopPropagation();

    // release capture if we implicitly got it (happens with touch by default)
    if (!(e.target instanceof HTMLElement)) {
      throw new Error('unclear if this can happen');
    }

    if (e.target.hasPointerCapture(e.pointerId)) {
      e.target.releasePointerCapture(e.pointerId);
    }

    if (!blockElem.current) {
      throw new Error();
    }
    const rect = blockElem.current.getBoundingClientRect();
    const offset: Vec2 = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const dragNode: ASTNode = (ctx.kind === 'palette') ? treeRandomizeNodeIds(node, () => true) : node;

    if (ctx.kind === 'code') {
      ctx.dispatch({
        type: 'removeNodeForDrag',
        node: dragNode,
      });
    }

    ctx.editorCtx.beginDragValue({
      pointerId: e.pointerId,
      typeId: 'codeEditor/node',
      value: dragNode,
      pos: {
        x: e.clientX,
        y: e.clientY,
      },
      offset,
      dims: {x: rect.width, y: rect.height},
      previewElem: blockElem.current.cloneNode(true) as HTMLElement,
    });
  };

  let dropHL = false;
  for (const dropLoc of ctx.dropLocs) {
    if (dropLoc.type === 'ontoNode') {
      if (dropLoc.nodeId === node.nid) {
        dropHL = true;
        break;
      }
    }
  }

  return (
    <div
      className={'CodeEditor-block' + (' CodeEditor-block-style-' + style) + (dropHL ? ' CodeEditor-block-highlight' : '')}
      ref={blockElem}
      onPointerDown={handlePointerDown}
      data-node-id={node.nid}
      data-list-item={isListItem || undefined}
      data-allowed={allowed}
    >
      {children}
    </div>
  );
};

const BlockLine: React.FC<{children: React.ReactNode}> = ({children}) => {
  return <div className="CodeEditor-block-line">{children}</div>
};

const BlockLineText: React.FC<{text: string}> = ({text}) => {
  return <div className="CodeEditor-block-line-text">{text}</div>
};

const BlockVListSep: React.FC<{idx: number, parentNodeId: NodeId | undefined, hl: boolean, last: boolean, allowed: string}> = ({idx, parentNodeId, hl, last, allowed}) => {
  return <div
    className={'CodeEditor-block-vlist-sep' + (hl ? ' CodeEditor-block-vlist-sep-highlight': '')}
    data-parent-node-id={parentNodeId}
    data-index={idx}
    data-last={last || undefined}
    data-allowed={allowed}
  />;
}

const BlockVList: React.FC<{childViews: ReadonlyMap<string, React.ReactNode>, dropIdxs: ReadonlySet<number>, parentNodeId: NodeId | undefined, allowed: string}> = ({childViews, dropIdxs, parentNodeId, allowed}) => {
  return (
    <div className="CodeEditor-block-vlist">
      {(childViews.size > 0) ? Array.from(childViews).map(([key, child], idx) => (
        <React.Fragment key={key}>
          <BlockVListSep idx={idx} parentNodeId={parentNodeId} hl={dropIdxs.has(idx)} last={false} allowed={allowed} />
          {child}

          {(idx === (childViews.size-1)) &&
            <BlockVListSep idx={idx+1} parentNodeId={parentNodeId} hl={dropIdxs.has(idx+1)} last={true} allowed={allowed} />
          }
        </React.Fragment>
      )) : <BlockVListSep idx={0} parentNodeId={parentNodeId} hl={dropIdxs.has(0)} last={true} allowed={allowed} />}
    </div>
  );
};

type NodeViewCtxKind = 'palette' | 'code';
interface NodeViewCtx {
  readonly kind: NodeViewCtxKind;
  readonly varAn: ReadonlyMap<NodeId, Analysis>;
  readonly varName: ReadonlyMap<NodeId, VarNameNode>;
  readonly dispatch: CodeEditorDispatch;
  readonly allowDrag: 'yes' | 'no' | 'no-children';
  readonly editorCtx: EditorContext<Code, undefined>;
  readonly dropLocs: ReadonlyArray<DropLoc>;
}

const HoleView: React.FC<{node: HoleNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
  return (
    <Block
      node={node}
      ctx={ctx}
      style="hole"
      isListItem={isListItem}
      allowed={allowed}
    >&nbsp;</Block>
  );
};

const EVPreview: React.FC<{ev: EVWrapper<any>, previewer: Previewer<any>}> = ({ev, previewer}) => {
  useConstant(ev);
  useConstant(previewer);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewerReturnRef = useRef<PreviewerReturn<any> | null>(null);

  useEffect(() => {
    invariant(containerRef.current);

    invariant(!previewerReturnRef.current);
    previewerReturnRef.current = previewer.create({
      container: containerRef.current,
      ev,
    });

    return () => {
      invariant(previewerReturnRef.current);
      if (previewerReturnRef.current.cleanup) {
        previewerReturnRef.current.cleanup();
      }
      previewerReturnRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="CodeEditor-EVPreview" />;
};

const LiteralView: React.FC<{node: LiteralNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue: string | number | boolean;
    switch (node.sub.type) {
      case 'string': {
        newValue = e.target.value;
        ctx.dispatch({
          type: 'replaceNode',
          oldNode: node,
          newNode: {
            ...node,
            sub: {
              ...node.sub,
              value: newValue,
            },
          },
        });
        break;
      }

      case 'number': {
        newValue = Number(e.target.value);
        ctx.dispatch({
          type: 'replaceNode',
          oldNode: node,
          newNode: {
            ...node,
            sub: {
              ...node.sub,
              value: newValue,
            },
          },
        });
        break;
      }

      default:
        throw new Error('unimplemented: ' + node.sub.type);
    }
  };

  return (
    <Block node={node} ctx={ctx} style={(node.sub.type === 'ev') ? 'ev' : 'expr'} isListItem={isListItem} allowed={allowed}>
      <BlockLine>
        {(() => {
          switch (node.sub.type) {
            case 'string':
              return <input type="text" value={node.sub.value} onChange={handleChange} />

            case 'number':
              return <input type="number" value={node.sub.value} onChange={handleChange} />

            case 'ev': {
              const previewer = ctx.editorCtx.getPreviewer(node.sub.value.typeId);
              invariant(previewer);
              return <EVPreview ev={node.sub.value} previewer={previewer} />
            }

            default:
              throw new Error('unimplemented: ' + node.sub.type);
          }
        })()}
      </BlockLine>
    </Block>
  );
};

const FnAppView: React.FC<{node: FnAppNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
  const fnAn = ctx.varAn.get(node.fn);
  invariant(fnAn !== undefined);
  invariant(fnAn.type.type === 'Fn');
  const parsed = parseFnTmplText(fnAn.type.iface.tmpl);

  const childCtx = {...ctx, allowDrag: (ctx.allowDrag === 'no-children') ? 'no' : ctx.allowDrag};

  return (
    <Block node={node} ctx={ctx} style="expr" isListItem={isListItem} allowed={allowed}>
      {parsed.lines.map((line, idx) => (
        <BlockLine key={idx}>
          {line.map((item, idx) => {
            switch (item.type) {
              case 'text': {
                return <BlockLineText key={idx} text={item.text} />
              }

              case 'param': {
                // TODO: make use of item.label if arg node is a hole?
                const arg = node.args.get(item.pid);
                invariant(arg);
                return <NodeView key={item.pid} node={arg} ctx={childCtx} isListItem={false} allowed="value" />
              }

              default:
                throw new Error('unimplemented');
            }
          })}
        </BlockLine>
      ))}
    </Block>
  );
};

const VarRefView: React.FC<{node: VarRefNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
  const refNode = ctx.varName.get(node.refId);
  invariant(refNode !== undefined);
  return (
    <Block node={node} ctx={ctx} style="expr" isListItem={isListItem} allowed={allowed}>
      <BlockLine>
        <BlockLineText text={refNode.name} />
      </BlockLine>
    </Block>
  );
};

const EqView: React.FC<{node: EqNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
  const childCtx = {...ctx, allowDrag: (ctx.allowDrag === 'no-children') ? 'no' : ctx.allowDrag};

  return (
    <Block node={node} ctx={ctx} style="decl" isListItem={isListItem} allowed={allowed}>
      <BlockLine>
        <NodeView node={node.lhs} ctx={childCtx} isListItem={false} allowed="bind" />
        <BlockLineText text="=" />
        <NodeView node={node.rhs} ctx={childCtx} isListItem={false} allowed="value" />
      </BlockLine>
    </Block>
  );
};

const ProgramView: React.FC<{node: ProgramNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  return <DeclListView decls={node.decls} parentNode={node} ctx={ctx} />;
}

const NodeView: React.FC<{node: ASTNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
  switch (node.type) {
    case 'Hole':
      return <HoleView key={node.nid} node={node} ctx={ctx} isListItem={isListItem} allowed={allowed} />

    case 'Literal':
      return <LiteralView key={node.nid} node={node} ctx={ctx} isListItem={isListItem} allowed={allowed} />

    case 'FnApp':
      return <FnAppView key={node.nid} node={node} ctx={ctx} isListItem={isListItem} allowed={allowed} />

    case 'VarRef':
      return <VarRefView key={node.nid} node={node} ctx={ctx} isListItem={isListItem} allowed={allowed} />

    case 'Eq':
      return <EqView key={node.nid} node={node} ctx={ctx} isListItem={isListItem} allowed={allowed} />

    default:
      throw new Error('unimplemented');
  }
};

const DeclListView: React.FC<{decls: ReadonlyArray<DeclNode>, parentNode: ASTNode, ctx: NodeViewCtx}> = ({decls, parentNode, ctx}) => {
  const childViews = new Map(decls.map(decl => [decl.nid, <NodeView key={decl.nid} node={decl} ctx={ctx} isListItem={true} allowed="decl" />]));

  const dropIdxs: Set<number> = new Set();
  for (const dropLoc of ctx.dropLocs) {
    if ((dropLoc.type === 'intoList') && (dropLoc.nodeId === parentNode.nid)) {
      dropIdxs.add(dropLoc.idx);
    }
  }

  return <BlockVList childViews={childViews} dropIdxs={dropIdxs} parentNodeId={parentNode.nid} allowed="decl" />;
}

type DropLoc =
  {
    readonly type: 'ontoNode';
    readonly nodeId: NodeId;
  } | {
    readonly type: 'intoList';
    readonly nodeId: NodeId; // node which has a child list. we assume nodes can only have one child list
    readonly idx: number; // may equal list length to go after last
  };

type CodeEditorAction =
  {
    readonly type: 'replaceNode';
    readonly oldNode: ASTNode;
    readonly newNode: ASTNode;
  } | {
    readonly type: 'removeNodeForDrag';
    readonly node: ASTNode;
  } | {
    readonly type: 'setPotentialDrop';
    readonly dragId: string;
    readonly potentialNode: ASTNode;
    readonly dropLoc: DropLoc;
  } | {
    readonly type: 'removePotentialDrop';
    readonly dragId: string;
  } | {
    readonly type: 'endDrag';
    readonly dragId: string;
  };

type CodeEditorDispatch = React.Dispatch<CodeEditorAction>;

interface CodeEditorState {
  readonly program: ProgramNode;
  readonly potentialDrops: ReadonlyMap<string, { // key is dragId
    readonly potentialNode: ASTNode;
    readonly dropLoc: DropLoc;
  }>;
}

function progReplaceNodeHelper(program: ProgramNode, oldPred: (node: ASTNode) => boolean, newNode: ASTNode): ProgramNode {
  let replaceCount = 0;

  const transform = (node: ASTNode): ASTNode => {
    if (oldPred(node)) {
      replaceCount++;
      return newNode;
    } else {
      return transformChildren(node, transform, undefined);
    }
  }

  const newProgram = transform(program);
  invariant(isProgramNode(newProgram));

  invariant(replaceCount === 1, 'expected exactly one node to be replaced');

  return newProgram;
}

function progReplaceNode(program: ProgramNode, oldNode: ASTNode, newNode: ASTNode): ProgramNode {
  return progReplaceNodeHelper(program, node => (node === oldNode), newNode);
}

function progReplaceNodeId(program: ProgramNode, oldNodeId: NodeId, newNode: ASTNode): ProgramNode {
  return progReplaceNodeHelper(program, node => (node.nid === oldNodeId), newNode);
}

function progInsertListNode(program: ProgramNode, parentNodeId: NodeId, idx: number, newNode: ASTNode): ProgramNode {
  let insertCount = 0;

  const transform = (node: ASTNode): ASTNode => {
    if (node.nid === parentNodeId) {
      insertCount++;

      switch (node.type) {
        case 'Program': {
          invariant(isDeclNode(newNode));
          return {
            ...node,
            decls: insertIntoArray(node.decls, idx, newNode),
          };
        }

        default:
          throw new Error('unimplemented');
      }
    } else {
      return transformChildren(node, transform, undefined);
    }
  }

  const newProgram = transform(program);
  invariant(isProgramNode(newProgram));

  invariant(insertCount === 1, 'expected exactly one insertion site');

  return newProgram;
}

function progRemoveListNode(program: ProgramNode, nodeId: NodeId): ProgramNode {
  let removeCount = 0;

  const transform = (node: ASTNode): ASTNode => {
    let newNode = node;
    switch (node.type) {
      case 'Program': {
        const matches = node.decls.filter(decl => (decl.nid === nodeId));
        if (matches.length > 0) {
          removeCount += matches.length;
          newNode = {
            ...node,
            decls: node.decls.filter(decl => (decl.nid !== nodeId)),
          };
        }
      }
    }

    return transformChildren(newNode, transform, undefined);
  }

  const newProgram = transform(program);
  invariant(isProgramNode(newProgram));

  invariant(removeCount === 1, 'expected exactly one node removed');

  return newProgram;
}

function treeRandomizeNodeIds(root: ASTNode, nodePred: (node: ASTNode) => boolean): ASTNode {
  const transform = (node: ASTNode): ASTNode => {
    const newNode = nodePred(node) ? {
      ...node,
      nid: genUidRandom(),
    } : node;

    return transformChildren(newNode, transform, undefined);
  }

  const newRoot = transform(root);

  return newRoot;
}

function reducer(state: CodeEditorState, action: CodeEditorAction): CodeEditorState {
  switch (action.type) {
    case 'replaceNode': {
      const {oldNode, newNode} = action;

      return {
        ...state,
        program: progReplaceNode(state.program, oldNode, newNode),
      };
    }

    case 'removeNodeForDrag': {
      if (isDeclNode(action.node)) {
        return {
          ...state,
          program: progRemoveListNode(state.program, action.node.nid),
        };
      } else if (isValueExprNode(action.node) || isBindExprNode(action.node)) {
        return {
          ...state,
          program: progReplaceNodeId(state.program, action.node.nid, {
            type: 'Hole',
            nid: genUidRandom(),
          }),
        };
      } else {
        throw new Error('unimplemented');
      }
    }

    case 'setPotentialDrop': {
      const newPotentialDrops = new Map(state.potentialDrops);
      newPotentialDrops.set(action.dragId, {
        potentialNode: action.potentialNode,
        dropLoc: action.dropLoc,
      });
      return {
        ...state,
        potentialDrops: newPotentialDrops,
      };
    }

    case 'removePotentialDrop': {
      if (state.potentialDrops.has(action.dragId)) {
        const newPotentialDrops = new Map(state.potentialDrops);
        newPotentialDrops.delete(action.dragId);
        return {
          ...state,
          potentialDrops: newPotentialDrops,
        };
      } else {
        return state;
      }
    }

    case 'endDrag': {
      if (state.potentialDrops.has(action.dragId)) {
        const pd = state.potentialDrops.get(action.dragId);
        invariant(pd);

        const newPotentialDrops = new Map(state.potentialDrops);
        newPotentialDrops.delete(action.dragId);

        switch (pd.dropLoc.type) {
          case 'ontoNode': {
            return {
              ...state,
              program: progReplaceNodeId(state.program, pd.dropLoc.nodeId, pd.potentialNode),
              potentialDrops: newPotentialDrops,
            };
          }

          case 'intoList': {
            return {
              ...state,
              program: progInsertListNode(state.program, pd.dropLoc.nodeId, pd.dropLoc.idx, pd.potentialNode),
              potentialDrops: newPotentialDrops,
            };
          }
        }
      } else {
        return state;
      }
    }
  }
}

const CodeEditor: React.FC<{editorCtx: EditorContext<Code, undefined>}> = ({editorCtx}) => {
  const [state, dispatch] = useReducer(reducer, null, (): CodeEditorState => {
    return {
      program: editorCtx.initialValue,
      potentialDrops: new Map(),
    };
  });

  const codeValRef = useRef<Code>(editorCtx.initialValue);
  useEffect(() => {
    if (state.program !== codeValRef.current) {
      codeValRef.current = state.program;
      editorCtx.valueChanged(state.program);
    }
  });

  const editorRef = useRef<HTMLDivElement>(null);

  const fnIfaces: ReadonlyArray<[NodeId, FnExtIface]> = [
    ['gt', {
      tmpl: '{a|A} is greater than {b|B}',
      params: [
        {pid: 'a', type: {type: 'Num'}},
        {pid: 'b', type: {type: 'Num'}},
      ],
    }],
    ['lt', {
      tmpl: '{a|A} is less than {b|B}',
      params: [
        {pid: 'a', type: {type: 'Num'}},
        {pid: 'b', type: {type: 'Num'}},
      ],
    }],
    ['nearestInstPos', {
      tmpl: 'position of nearest {sprite|Sprite}',
      params: [
        {pid: 'sprite', type: {type: 'EV', typeId: 'sprite'}},
      ],
    }],
  ];

  // the "named returns" of the implicit top-level function, with their expected types
  const topReturns: ReadonlyArray<[ASTNode, Type]> = [
    [{type: 'VarName', nid: 'moveTarget', name: 'move target'}, {type: 'Vec2'}],
    [{type: 'VarName', nid: 'moveSpeed', name: 'move speed'}, {type: 'Num'}],
  ];

  const varAn: Map<NodeId, Analysis> = new Map();

  fnIfaces.forEach(([nid, iface]) => {
    varAn.set(nid, {type: {type: 'Fn', iface}})
  });

  const varName: Map<NodeId, VarNameNode> = new Map();

  topReturns.forEach(([node, _]) => {
    invariant(node.type === 'VarName');
    varName.set(node.nid, node);
  });

  varName.set('origin', {type: 'VarName', nid: 'origin', name: 'origin'});

  const paletteNodes: ReadonlyArray<ASTNode> = [
    ...fnIfaces.map(([nid, iface]) => makeFnApp('palette-'+nid, nid, iface)),
    {
      type: 'Eq',
      nid: 'palette-eq',
      lhs: {type: 'Hole', nid: 'eq_lhs'},
      rhs: {type: 'Hole', nid: 'eq_rhs'},
    },
    {
      type: 'Eq',
      nid: 'palette-return-move-target',
      lhs: {type: 'VarRef', nid: 'eq_lhs', refId: 'moveTarget'},
      rhs: {type: 'Hole', nid: 'eq_rhs'},
    },
    {
      type: 'Eq',
      nid: 'palette-return-move-speed',
      lhs: {type: 'VarRef', nid: 'eq_lhs', refId: 'moveSpeed'},
      rhs: {type: 'Hole', nid: 'eq_rhs'},
    },
    {
      type: 'Literal',
      nid: 'palette-number-0',
      sub: {type: 'number', value: 0},
    },
    {
      type: 'Eq',
      nid: 'palette-return-move-speed-num',
      lhs: {type: 'VarRef', nid: 'eq_lhs', refId: 'moveSpeed'},
      rhs: {type: 'Literal', nid: 'eq_rhs', sub: {type: 'number', value: 10}},
    },
    {
      type: 'VarRef',
      nid: 'palette-origin',
      refId: 'origin',
    },
  ];

  const handlePointerMove = (e: Event) => {
    const ed = (e as CustomEvent<PointerEventData>).detail;
    invariant(ed);

    const matchesAllowed = (node: ASTNode, allowed: string) => {
      switch (allowed) {
        case 'decl':
          return isDeclNode(node);

        case 'value':
          return isValueExprNode(node);

        case 'bind':
          return isBindExprNode(node);

        case 'none':
          return false;

        default:
          throw new Error('unimplemented');
      }
    };

    const di = ed.dragInfo;
    if (!di) {
      return;
    }

    let potentialNode: ASTNode | undefined = undefined;
    if ((di.payload.type === 'value') && (di.payload.typeId === 'codeEditor/node')) {
      potentialNode = di.payload.value;
    } else if ((di.payload.type === 'ev') && (di.payload.ev.typeId === 'sprite')) {
      potentialNode = {
        type: 'Literal',
        nid: genUidRandom(),
        sub: {type: 'ev', value: di.payload.ev},
      };
    }
    if (!potentialNode) {
      return;
    }

    if (!editorRef.current) {
      return;
    }
    const codeArea = editorRef.current.querySelector('.CodeEditor-code');
    invariant(codeArea);
    const codeAreaRect = codeArea.getBoundingClientRect();
    const insideCodeArea = pointInRect(ed.pos, codeAreaRect);

    if (insideCodeArea) {
      // inside code area
      const MAX_DROP_DIST = 100;
      let nearestDropLoc: DropLoc | undefined = undefined;
      let nearestDropLocDist = Infinity;

      const dragPos = ed.pos;

      const sepElems = codeArea.querySelectorAll('.CodeEditor-block-vlist-sep');
      for (let i = 0; i < sepElems.length; i++) {
        const sepElem = sepElems[i];

        const allowed = sepElem.getAttribute('data-allowed');
        invariant(allowed !== null);
        if (!matchesAllowed(potentialNode, allowed)) {
          continue;
        }

        const sepRect = sepElem.getBoundingClientRect();
        const dist = Math.abs(0.5*(sepRect.top+sepRect.bottom) - dragPos.y);
        if (dist < nearestDropLocDist) {
          if ((dist <= MAX_DROP_DIST) || sepElem.getAttribute('data-last')) {
            const parentNodeId = sepElem.getAttribute('data-parent-node-id');
            invariant(parentNodeId !== null);
            const idxStr = sepElem.getAttribute('data-index');
            invariant(idxStr !== null);
            const idx = +idxStr;

            nearestDropLoc = {type: 'intoList', nodeId: parentNodeId, idx};
            nearestDropLocDist = dist;
          }
        }
      }

      const nodeElems = codeArea.querySelectorAll('.CodeEditor-block');
      for (let i = 0; i < nodeElems.length; i++) {
        const nodeElem = nodeElems[i];

        if (nodeElem.getAttribute('data-list-item') !== null) {
          // prevent dropping onto list items
          continue;
        }

        const allowed = nodeElem.getAttribute('data-allowed');
        invariant(allowed !== null);
        if (!matchesAllowed(potentialNode, allowed)) {
          continue;
        }

        const nodeRect = nodeElem.getBoundingClientRect();
        const nodeX = 0.5*(nodeRect.left+nodeRect.right);
        const nodeY = 0.5*(nodeRect.top+nodeRect.bottom);
        const dist = Math.sqrt((nodeX-dragPos.x)**2 + (nodeY-dragPos.y)**2);
        if (dist < nearestDropLocDist) {
          if (dist <= MAX_DROP_DIST) {
            const nodeId = nodeElem.getAttribute('data-node-id');
            invariant(nodeId !== null);
            nearestDropLoc = {type: 'ontoNode', nodeId};
            nearestDropLocDist = dist;
          }
        }
      }

      if (nearestDropLoc) {
        dispatch({
          type: 'setPotentialDrop',
          dragId: di.dragId,
          potentialNode,
          dropLoc: nearestDropLoc,
        });
      } else {
        dispatch({
          type: 'removePotentialDrop',
          dragId: di.dragId,
        });
      }
    } else {
      // not inside code area
      dispatch({
        type: 'removePotentialDrop',
        dragId: di.dragId,
      });
    }
  };

  const handlePointerUp = (e: Event) => {
    const ed = (e as CustomEvent<PointerEventData>).detail;
    invariant(ed);

    const di = ed.dragInfo
    if (!di) {
      return;
    }

    dispatch({
      type: 'endDrag',
      dragId: di.dragId,
    });
  };

  useEffect(() => {
    editorCtx.pointerEventTarget.addEventListener('pointerMove', handlePointerMove);
    editorCtx.pointerEventTarget.addEventListener('pointerUp', handlePointerUp);
    return () => {
      editorCtx.pointerEventTarget.removeEventListener('pointerMove', handlePointerMove);
      editorCtx.pointerEventTarget.removeEventListener('pointerUp', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return (
    <div
      className="CodeEditor"
      ref={editorRef}
    >
      <div className="CodeEditor-palette">
        {paletteNodes.map((node) => (
          <NodeView
            key={node.nid}
            node={node}
            ctx={{
              kind: 'palette',
              varAn,
              varName,
              dispatch,
              allowDrag: 'no-children',
              editorCtx,
              dropLocs: [],
            }}
            isListItem={false}
            allowed="none"
          />
        ))}
      </div>
      <div className="CodeEditor-code">
        <ProgramView
          node={state.program}
          ctx={{
            kind: 'code',
            varAn,
            varName,
            dispatch,
            allowDrag: 'yes',
            editorCtx,
            dropLocs: [...state.potentialDrops.values()].map(info => info.dropLoc),
          }}
        />
      </div>
    </div>
  );
};

const codeEditor: Editor<Code, undefined> = {
  create: (context) => {
    // This is a total mess, but seems to work. As of the time of writing this,
    // React doesn't allow you to unmount a root during a useEffect cleanup?!
    // See:
    // - https://github.com/facebook/react/issues/25675
    // - https://stackoverflow.com/questions/73043828/how-to-unmount-something-created-with-createroot-properly
    // So we jump through these hoops, which don't seem safe but seem to work.
    // The problem is that because the actual unmount happens in a setTimeout,
    // I think another editor could try to mount in the same container before
    // this unmount happens.
    let unmount: () => void = () => { requestedUmount = true; };
    let requestedUmount = false;
    setTimeout(() => {
      if (!requestedUmount) {
        const root = ReactDOM.createRoot(context.container);
        root.render(
          <React.StrictMode>
            <CodeEditor editorCtx={context} />
          </React.StrictMode>
        );
        unmount = () => {
          setTimeout(() => {
            root.unmount();
          }, 0);
        };
      }
    }, 0);

    return {
      cleanup: () => {
        unmount();
      },
    };
  }
};

export default codeEditor;
