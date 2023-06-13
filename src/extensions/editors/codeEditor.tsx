import React, { useReducer, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Editor, EditorContext, ValueDragInfo } from '../../extlib/editor';
import { genUidRandom, invariant } from '../../util';
import { Vec2, vec2dist, vec2sub } from '../../vec';
import { ASTNode, Code, DeclNode, EqNode, FnAppNode, HoleNode, isBindExprNode, isDeclNode, isValueExprNode, Name, NodeId, TmpDeclNode, ValueExprNode, VarNameNode, VarRefNode } from '../types/code';
import './codeEditor.css';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function pointInRect(p: Vec2, r: Rect): boolean {
  return ((p.x >= r.left) && (p.x < (r.left+r.width)) && (p.y > r.top) && (p.y < (r.top+r.height)));
}

function transformNodeArr<N extends ASTNode>(arr: ReadonlyArray<N>, pred: (n: ASTNode) => n is N, transform: (node: ASTNode) => ASTNode): ReadonlyArray<N> {
  let changed = false;
  const newArr = arr.map(el => {
    const nel = transform(el);
    if (!pred(nel)) {
      throw new Error();
    }
    if (nel !== el) {
      changed = true;
    }
    return nel;
  });
  return changed ? newArr : arr;
}

function transformChildren<N extends ASTNode, X>(node: N, transform: (node: ASTNode, ctx: X) => ASTNode, ctx: X): N {
  // this could be factored out like transformNodeArr above
  const xChild = <C extends ASTNode>(n: C, pred: (n: ASTNode) => n is C): C => {
    const tn = transform(n, ctx);
    if (!pred(tn)) {
      throw new Error();
    }
    return tn;
  }

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

    case 'TmpDecl': {
      const newDecl = xChild(node.decl, isDeclNode);

      if (newDecl === node.decl) {
        return node;
      } else {
        return {
          ...node,
          decl: newDecl,
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
  | {type: 'Vec2'};

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

const Block: React.FC<{children: React.ReactNode, node: ASTNode, ctx: NodeViewCtx}> = ({children, node, ctx}) => {
  const blockElem = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();

    if (ctx.allowDrag === 'no') {
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

    // TODO: if we're dragging a tree of more than one node, need to "deep"-regenerate new node ids for all of them
    const dragNode: ASTNode = (ctx.kind === 'palette') ? {...node, nid: genUidRandom()} : node;

    if (ctx.kind === 'code-regular') {
      if (!isDeclNode(dragNode)) {
        throw new Error('unimplemented');
      }

      // TODO: wrap this decl node in a TmpDecl node, dispatch action to update AST
      const newNode: TmpDeclNode = {
        type: 'TmpDecl',
        nid: genUidRandom(),
        decl: dragNode,
      };
      ctx.dispatch({
        type: 'replaceNode',
        oldNode: dragNode,
        newNode,
      });
    }

    ctx.editorCtx.beginDrag(
      'codeEditor/node',
      e.pointerId,
      dragNode,
      {
        x: e.clientX,
        y: e.clientY,
      },
      blockElem.current.cloneNode(true) as HTMLElement,
      offset,
    );
  };

  return (
    <div
      className="CodeEditor-block"
      ref={blockElem}
      onPointerDown={handlePointerDown}
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

const BlockVList: React.FC<{children: React.ReactNode}> = ({children}) => {
  return <div className="CodeEditor-block-vlist">{children}</div>
};

type NodeViewCtxKind = 'palette' | 'code-regular' | 'code-tmp';
interface NodeViewCtx {
  readonly kind: NodeViewCtxKind;
  readonly varAn: ReadonlyMap<NodeId, Analysis>;
  readonly varName: ReadonlyMap<NodeId, VarNameNode>;
  readonly dispatch: CodeEditorDispatch;
  readonly allowDrag: 'yes' | 'no' | 'no-children';
  readonly editorCtx: EditorContext<Code, undefined>;
}

const HoleView: React.FC<{node: HoleNode, ctx: NodeViewCtx}> = ({node}) => {
  return <div className="CodeEditor-hole"></div>
};

const FnAppView: React.FC<{node: FnAppNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  const fnAn = ctx.varAn.get(node.fn);
  invariant(fnAn !== undefined);
  invariant(fnAn.type.type === 'Fn');
  const parsed = parseFnTmplText(fnAn.type.iface.tmpl);

  const childCtx = {...ctx, allowDrag: (ctx.allowDrag === 'no-children') ? 'no' : ctx.allowDrag};

  return (
    <Block node={node} ctx={ctx}>
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
                return <NodeView key={item.pid} node={arg} ctx={childCtx} />
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

const VarRefView: React.FC<{node: VarRefNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  const refNode = ctx.varName.get(node.refId);
  invariant(refNode !== undefined);
  return (
    <Block node={node} ctx={ctx}>
      <BlockLine>
        <BlockLineText text={refNode.name} />
      </BlockLine>
    </Block>
  );
};

const EqView: React.FC<{node: EqNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  const childCtx = {...ctx, allowDrag: (ctx.allowDrag === 'no-children') ? 'no' : ctx.allowDrag};

  return (
    <Block node={node} ctx={ctx}>
      <BlockLine>
        <NodeView node={node.lhs} ctx={childCtx} />
        <BlockLineText text="=" />
        <NodeView node={node.rhs} ctx={childCtx} />
      </BlockLine>
    </Block>
  );
};

const NodeView: React.FC<{node: ASTNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  switch (node.type) {
    case 'Hole':
      return <HoleView key={node.nid} node={node} ctx={ctx} />

    case 'FnApp':
      return <FnAppView key={node.nid} node={node} ctx={ctx} />

    case 'VarRef':
      return <VarRefView key={node.nid} node={node} ctx={ctx} />

    case 'Eq':
      return <EqView key={node.nid} node={node} ctx={ctx} />

    case 'TmpDecl':
      return <div key={node.nid} className="CodeEditor-tmp-node"><NodeView node={node.decl} ctx={{...ctx, kind: 'code-tmp'}} /></div>

    default:
      throw new Error('unimplemented');
  }
};

const DeclListView: React.FC<{decls: ReadonlyArray<DeclNode>, ctx: NodeViewCtx}> = ({decls, ctx}) => {
  return (
    <BlockVList>
      {decls.map(decl => (
        <NodeView key={decl.nid} node={decl} ctx={ctx} />
      ))}
    </BlockVList>
  );
}

type CodeEditorAction =
  {
    readonly type: 'addDraggedDecl';
    readonly decl: DeclNode;
  } | {
    readonly type: 'removeDraggedDecl';
    readonly decl: DeclNode;
  } | {
    readonly type: 'acceptDraggedDecl';
    readonly decl: DeclNode;
  } | {
    readonly type: 'replaceNode';
    readonly oldNode: ASTNode;
    readonly newNode: ASTNode;
  };

type CodeEditorDispatch = React.Dispatch<CodeEditorAction>;

interface CodeEditorState {
  readonly decls: ReadonlyArray<DeclNode>;
}

const INIT_STATE: CodeEditorState = {
  decls: [],
};

function reducer(state: CodeEditorState, action: CodeEditorAction): CodeEditorState {
  switch (action.type) {
    case 'addDraggedDecl': {
      const idx = state.decls.findIndex(decl => (decl.type === 'TmpDecl') && (decl.decl === action.decl));
      if (idx < 0) {
        // don't have yet, so create
        const tmpDecl: TmpDeclNode = {type: 'TmpDecl', nid: 'tmp-'+action.decl.nid, decl: action.decl};
        const newDecls = [...state.decls, tmpDecl];
        return {
          ...state,
          decls: newDecls,
        };
      } else {
        return state;
      }
    }

    case 'removeDraggedDecl': {
      const idx = state.decls.findIndex(decl => (decl.type === 'TmpDecl') && (decl.decl === action.decl));
      if (idx >= 0) {
        const newDecls = state.decls.filter((_, i) => i !== idx);
        return {
          ...state,
          decls: newDecls,
        };
      } else {
        return state;
      }
    }

    case 'acceptDraggedDecl': {
      const idx = state.decls.findIndex(decl => (decl.type === 'TmpDecl') && (decl.decl === action.decl));
      if (idx >= 0) {
        const newDecls = state.decls.map(decl => {
          if ((decl.type === 'TmpDecl') && (decl.decl === action.decl)) {
            return decl.decl;
          } else {
            return decl;
          }
        });
        return {
          ...state,
          decls: newDecls,
        };
      } else {
        return state;
      }
    }

    case 'replaceNode': {
      const {oldNode, newNode} = action;

      const transform = (node: ASTNode): ASTNode => {
        if (node === oldNode) {
          return newNode;
        } else {
          return transformChildren(node, transform, undefined);
        }
      }

      const newRootDecls = transformNodeArr(state.decls, isDeclNode, transform);

      return {
        ...state,
        decls: newRootDecls,
      };
    }
  }
}

const CodeEditor: React.FC<{editorCtx: EditorContext<Code, undefined>}> = ({editorCtx}) => {
  const [state, dispatch] = useReducer(reducer, INIT_STATE);

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
  ];

  const handlePointerMove = (e: React.PointerEvent) => {
    const ne = e.nativeEvent as PointerEvent;
    const dv = (ne as any).draggingValue as (ValueDragInfo | undefined);
    if (!dv) {
      return;
    }
    if (dv.typeId !== 'codeEditor/node') {
      return;
    }
    const draggedNode = dv.value as ASTNode;

    if (!editorRef.current) {
      return;
    }
    const codeArea = editorRef.current.querySelector('.CodeEditor-code');
    invariant(codeArea);
    const codeAreaRect = codeArea.getBoundingClientRect();
    const insideCodeArea = pointInRect({x: ne.clientX, y: ne.clientY}, codeAreaRect);

    if (insideCodeArea) {
      // inside code area
      // create or move tmp node for this dragged node
      if (isDeclNode(draggedNode)) {
        dispatch({type: 'addDraggedDecl', decl: draggedNode});
      }
    } else {
      // not inside code area
      // if we have a Tmp node for this drag, remove it
      if (isDeclNode(draggedNode)) {
        dispatch({type: 'removeDraggedDecl', decl: draggedNode});
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const ne = e.nativeEvent as PointerEvent;
    const dv = (ne as any).draggingValue as (ValueDragInfo | undefined);
    if (!dv) {
      return;
    }
    if (dv.typeId !== 'codeEditor/node') {
      return;
    }
    const draggedNode = dv.value as ASTNode;

    // "unwrap" matching tmp decl
    if (isDeclNode(draggedNode)) {
      dispatch({type: 'acceptDraggedDecl', decl: draggedNode});
    } else {
      // ignore for now
    }
  };

  return (
    <div
      className="CodeEditor"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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
            }}
          />
        ))}
      </div>
      <div className="CodeEditor-code">
        <DeclListView
          decls={state.decls}
          ctx={{
            kind: 'code-regular',
            varAn,
            varName,
            dispatch,
            allowDrag: 'yes',
            editorCtx,
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
