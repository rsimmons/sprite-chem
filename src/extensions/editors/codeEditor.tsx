import React, { useContext, useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Editor } from '../../extlib/editor';
import { invariant } from '../../util';
import { Vec2, vec2dist, vec2sub } from '../../vec';
import { ASTNode, Code, DeclNode, EqNode, FnAppNode, HoleNode, isDeclNode, Name, NodeId, VarRefNode } from '../types/code';
import './codeEditor.css';

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
  | {type: 'Num'};

interface Analysis {
  readonly type: Type;
}

function makeFnApp(fnNid: NodeId, fnIface: FnExtIface): ASTNode {
  return {
    type: 'FnApp',
    nid: 'app',
    fn: fnNid,
    args: new Map(fnIface.params.map((p, idx) =>
      [p.pid, {
        type: 'Hole',
        nid: `arg${idx}`,
      }],
    )),
  };
}

const Block: React.FC<{children: React.ReactNode, ctx: NodeViewCtx}> = ({children, ctx}) => {
  const blockElem = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();

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

    ctx.dispatch({
      type: 'pointerDownOnNode',
      pointerId: e.pointerId,
      area: ctx.area,
      node: ctx.dragNode,
      pos: {
        x: e.clientX,
        y: e.clientY,
      },
      offset,
    });
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

interface NodeViewCtx {
  readonly varAn: ReadonlyMap<NodeId, Analysis>;
  readonly dispatch: CodeEditorDispatch;
  readonly area: DragArea;
  readonly dragNode: ASTNode;
}

const HoleView: React.FC<{node: HoleNode, ctx: NodeViewCtx}> = ({node}) => {
  return <div className="CodeEditor-hole"></div>
};

const FnAppView: React.FC<{node: FnAppNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  const fnAn = ctx.varAn.get(node.fn);
  invariant(fnAn !== undefined);
  invariant(fnAn.type.type === 'Fn');
  const parsed = parseFnTmplText(fnAn.type.iface.tmpl);

  return (
    <Block ctx={ctx}>
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
                return <NodeView key={idx} node={arg} ctx={ctx} />
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
  return <Block ctx={ctx}><BlockLine><BlockLineText text={`VarRef:${node.refId}`}></BlockLineText></BlockLine></Block>;
};

const EqView: React.FC<{node: EqNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  return <Block ctx={ctx}><BlockLine><BlockLineText text="="></BlockLineText></BlockLine></Block>;
};

const NodeView: React.FC<{node: ASTNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  switch (node.type) {
    case 'Hole':
      return <HoleView node={node} ctx={ctx} />

    case 'FnApp':
      return <FnAppView node={node} ctx={ctx} />

    case 'VarRef':
      return <VarRefView node={node} ctx={ctx} />

    case 'Eq':
      return <EqView node={node} ctx={ctx} />

    default:
      throw new Error('unimplemented');
  }
};

type DragArea = 'palette' | 'code' | 'drag';

type Region =
  {
    readonly type: 'other';
  } | {
    readonly type: 'codeBg';
  };

type CodeEditorAction =
  {
    readonly type: 'pointerDownOnNode';
    readonly pointerId: number;
    readonly area: DragArea;
    readonly node: ASTNode;
    readonly pos: Vec2;
    readonly offset: Vec2;
  } | {
    readonly type: 'pointerMove';
    readonly pointerId: number;
    readonly pos: Vec2;
    readonly region: Region;
  } | {
    readonly type: 'pointerUp';
    readonly pointerId: number;
    readonly region: Region;
  };

type CodeEditorDispatch = React.Dispatch<CodeEditorAction>;

type CodeEditorDragState =
  {
    readonly type: 'detachingNode',
    readonly pointerId: number,
    readonly area: DragArea,
    readonly node: ASTNode,
    readonly pos: Vec2;
    readonly offset: Vec2;
    readonly startPos: Vec2;
  } | {
    readonly type: 'draggingNode',
    readonly pointerId: number,
    readonly node: ASTNode,
    readonly pos: Vec2;
    readonly offset: Vec2;
  };

interface CodeEditorState {
  readonly dragStates: ReadonlyArray<CodeEditorDragState>;
  readonly decls: ReadonlyArray<DeclNode>;
}

const INIT_STATE: CodeEditorState = {
  dragStates: [],
  decls: [],
};

function reducer(state: CodeEditorState, action: CodeEditorAction): CodeEditorState {
  switch (action.type) {
    case 'pointerDownOnNode': {
      return {
        ...state,
        dragStates: state.dragStates.concat([{
          type: 'detachingNode',
          pointerId: action.pointerId,
          area: action.area,
          node: action.node,
          pos: action.pos,
          offset: action.offset,
          startPos: action.pos,
        }]),
      };
    }

    case 'pointerMove': {
      const ds = state.dragStates.find(s => s.pointerId === action.pointerId);
      if (ds === undefined) {
        return state;
      } else {
        switch (ds.type) {
          case 'detachingNode': {
            const dist = vec2dist(action.pos, ds.startPos);
            if (dist > 10) {
              const newDs: CodeEditorDragState = {
                type: 'draggingNode',
                pointerId: ds.pointerId,
                node: ds.node,
                pos: action.pos,
                offset: ds.offset,
              };

              return {
                ...state,
                dragStates: state.dragStates.map(s => (s === ds) ? newDs : s),
              };
            } else {
              return state;
            }
          }

          case 'draggingNode': {
            const newDs: CodeEditorDragState = {
              ...ds,
              pos: action.pos,
            };

            return {
              ...state,
              dragStates: state.dragStates.map(s => (s === ds) ? newDs : s),
            };
          }
        }
      }
    }

    case 'pointerUp': {
      const ds = state.dragStates.find(s => s.pointerId === action.pointerId);
      if (ds === undefined) {
        return state;
      } else {
        switch (ds.type) {
          case 'detachingNode': {
            return {
              ...state,
              dragStates: state.dragStates.filter(s => s !== ds),
            };
          }

          case 'draggingNode': {
            let newDecls = state.decls;
            if (action.region.type === 'codeBg') {
              const node = ds.node
              if (isDeclNode(ds.node)) {
                newDecls = newDecls.concat([ds.node]);
              }
            }

            return {
              ...state,
              dragStates: state.dragStates.filter(s => s !== ds),
              decls: newDecls,
            };
          }

          default:
            throw new Error('unimplemented');
        }
      }
    }
  }
}

const CodeEditor: React.FC = () => {
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

  const varAn: Map<NodeId, Analysis> = new Map();

  fnIfaces.forEach(([nid, iface]) => {
    varAn.set(nid, {type: {type: 'Fn', iface}})
  });

  const paletteNodes: ReadonlyArray<ASTNode> = [
    ...fnIfaces.map(([nid, iface]) => makeFnApp(nid, iface)),
    {
      type: 'Eq',
      nid: 'eq',
      lhs: {type: 'Hole', nid: 'eq_lhs'},
      rhs: {type: 'Hole', nid: 'eq_rhs'},
    },
  ];

  const [state, dispatch] = useReducer(reducer, INIT_STATE);

  const handlePointerMove = (e: PointerEvent, region: Region) => {
    dispatch({
      type: 'pointerMove',
      pointerId: e.pointerId,
      pos: {x: e.clientX, y: e.clientY},
      region,
    });
  };

  const handlePointerUp = (e: PointerEvent, region: Region) => {
    dispatch({
      type: 'pointerUp',
      pointerId: e.pointerId,
      region,
    });
  };

  useEffect(() => {
    const windowHandlePointerMove = (e: PointerEvent) => {
      handlePointerMove(e, {type: 'other'});
    };

    const windowHandlePointerUp = (e: PointerEvent) => {
      handlePointerUp(e, {type: 'other'});
    };

    window.addEventListener('pointermove', windowHandlePointerMove, false);
    window.addEventListener('pointerup', windowHandlePointerUp, false);

     return () => {
       window.removeEventListener('pointermove', windowHandlePointerMove, false);
       window.removeEventListener('pointerup', windowHandlePointerUp, false);
     };
   });

  return (
    <div className="CodeEditor">
      <div className="CodeEditor-palette">
        {paletteNodes.map((node) => (
          <NodeView
            node={node}
            ctx={{
              varAn,
              dispatch,
              area: 'palette',
              dragNode: node,
            }}
          />
        ))}
      </div>
      <div
        className="CodeEditor-code"
        onPointerMove={e => handlePointerMove(e.nativeEvent, {type: 'codeBg'})}
        onPointerUp={e => handlePointerUp(e.nativeEvent, {type: 'codeBg'})}
      >
        <BlockVList>
          {state.decls.map((decl) => (
            <NodeView
              node={decl}
              ctx={{
                varAn,
                dispatch,
                area: 'code',
                dragNode: decl,
              }}
            />
          ))}
        </BlockVList>
      </div>
      <div className="CodeEditor-drags">
        {state.dragStates.map(ds => {
          switch (ds.type) {
            case 'draggingNode': {
              const adjPos = vec2sub(ds.pos, ds.offset);
              return (
                <div
                  key={ds.pointerId}
                  style={{
                    position: 'absolute',
                    left: adjPos.x,
                    top: adjPos.y,
                  }}
                >
                  <NodeView
                    node={ds.node}
                    ctx={{
                      varAn,
                      dispatch,
                      area: 'drag',
                      dragNode: ds.node,
                    }}
                  />
                </div>
              );
            }
          }
          return null;
        })}
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
            <CodeEditor />
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
