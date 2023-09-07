import React, { useEffect, useRef } from 'react';
import { Vec2 } from "../../../vec";
import { ASTNode, Code, DeclNode, EmitNode, EqNode, FnAppNode, HoleNode, LiteralNode, NodeId, ProgramNode, StmtNode, VarNameNode, VarRefNode, WhenNode } from "../../types/code";
import { treeRandomizeNodeIds } from "./tree";
import { useConstant } from '../../../utilReact';
import { Previewer, PreviewerReturn } from '../../../extlib/previewer';
import { invariant } from '../../../util';
import { EVWrapper } from '../../../extlib/ev';
import { parseFnTmplText } from './fnTmpl';
import { CodeEditorDispatch, DropLoc } from './reducer';
import { EditorContext } from '../../../extlib/editor';
import { Analysis } from './analysis';

type NodeViewCtxKind = 'palette' | 'code';
interface NodeViewCtx {
  readonly kind: NodeViewCtxKind;
  readonly analysis: Analysis;
  readonly dispatch: CodeEditorDispatch;
  readonly allowDrag: 'yes' | 'no' | 'no-children';
  readonly editorCtx: EditorContext<Code, undefined>;
  readonly dropLocs: ReadonlyArray<[DropLoc, boolean]>; // boolean is "valid"
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

  let dropHL: 'none' | 'valid' | 'invalid' = 'none';
  for (const [dropLoc, valid] of ctx.dropLocs) {
    if (dropLoc.type === 'ontoNode') {
      if (dropLoc.nodeId === node.nid) {
        dropHL = valid ? 'valid' : 'invalid';
        break;
      }
    }
  }

  return (
    <div
      className={'CodeEditor-block' + (' CodeEditor-block-style-' + style) + ' CodeEditor-highlight-' + dropHL}
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

const BlockVListSep: React.FC<{idx: number, parentNodeId: NodeId | undefined, hl: 'none' | 'valid' | 'invalid', last: boolean, allowed: string}> = ({idx, parentNodeId, hl, last, allowed}) => {
  return <div
    className={'CodeEditor-block-vlist-sep' + ' CodeEditor-highlight-' + hl}
    data-parent-node-id={parentNodeId}
    data-index={idx}
    data-last={last || undefined}
    data-allowed={allowed}
  />;
}

const BlockVList: React.FC<{childViews: ReadonlyMap<string, React.ReactNode>, dropIdxs: ReadonlyMap<number, boolean>, parentNodeId: NodeId | undefined, allowed: string}> = ({childViews, dropIdxs, parentNodeId, allowed}) => {
  const dropIdxToHL = (idx: number) => {
    if (dropIdxs.has(idx)) {
      return dropIdxs.get(idx) ? 'valid' : 'invalid';
    } else {
      return 'none';
    }
  };

  return (
    <div className="CodeEditor-block-vlist">
      {(childViews.size > 0) ? Array.from(childViews).map(([key, child], idx) => (
        <React.Fragment key={key}>
          <BlockVListSep idx={idx} parentNodeId={parentNodeId} hl={dropIdxToHL(idx)} last={false} allowed={allowed} />
          {child}

          {(idx === (childViews.size-1)) &&
            <BlockVListSep idx={idx+1} parentNodeId={parentNodeId} hl={dropIdxToHL(idx+1)} last={true} allowed={allowed} />
          }
        </React.Fragment>
      )) : <BlockVListSep idx={0} parentNodeId={parentNodeId} hl={dropIdxToHL(0)} last={true} allowed={allowed} />}
    </div>
  );
};

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
      case 'text': {
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
            case 'text':
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
  const fnTy = ctx.analysis.nodeType.get(node.fn);
  invariant(fnTy !== undefined);
  invariant(fnTy.type === 'Fn');
  const parsed = parseFnTmplText(fnTy.iface.tmpl);

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
  const refName = ctx.analysis.varName.get(node.refId);
  invariant(refName !== undefined);
  return (
    <Block node={node} ctx={ctx} style="expr" isListItem={isListItem} allowed={allowed}>
      <BlockLine>
        <BlockLineText text={refName} />
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

const WhenView: React.FC<{node: WhenNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
  const childCtx = {...ctx, allowDrag: (ctx.allowDrag === 'no-children') ? 'no' : ctx.allowDrag};

  return (
    <Block node={node} ctx={ctx} style="decl" isListItem={isListItem} allowed={allowed}>
      <BlockLine>
        <BlockLineText text="when" />
        <NodeView node={node.evts} ctx={childCtx} isListItem={false} allowed="value" />
        {/* <NodeView node={node.rhs} ctx={childCtx} isListItem={false} allowed="value" /> */}
      </BlockLine>
      <StmtListView stmts={node.stmts} parentNode={node} ctx={childCtx} />
    </Block>
  );
};

const EmitView: React.FC<{node: EmitNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
  const childCtx = {...ctx, allowDrag: (ctx.allowDrag === 'no-children') ? 'no' : ctx.allowDrag};

  return (
    <Block node={node} ctx={ctx} style="stmt" isListItem={isListItem} allowed={allowed}>
      <BlockLine>
        <BlockLineText text="trigger" />
        <NodeView node={node.evts} ctx={childCtx} isListItem={false} allowed="bind" />
        <BlockLineText text="with" />
        <NodeView node={node.expr} ctx={childCtx} isListItem={false} allowed="value" />
      </BlockLine>
    </Block>
  );
}

export const ProgramView: React.FC<{node: ProgramNode, ctx: NodeViewCtx}> = ({node, ctx}) => {
  return <DeclListView decls={node.decls} parentNode={node} ctx={ctx} />;
}

export const NodeView: React.FC<{node: ASTNode, ctx: NodeViewCtx, isListItem: boolean, allowed: string}> = ({node, ctx, isListItem, allowed}) => {
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

    case 'When':
      return <WhenView key={node.nid} node={node} ctx={ctx} isListItem={isListItem} allowed={allowed} />

    case 'Emit':
      return <EmitView key={node.nid} node={node} ctx={ctx} isListItem={isListItem} allowed={allowed} />

    default:
      throw new Error('unimplemented');
  }
};

const DeclListView: React.FC<{decls: ReadonlyArray<DeclNode>, parentNode: ASTNode, ctx: NodeViewCtx}> = ({decls, parentNode, ctx}) => {
  const childViews = new Map(decls.map(decl => [decl.nid, <NodeView key={decl.nid} node={decl} ctx={ctx} isListItem={true} allowed="decl" />]));

  const dropIdxs: Map<number, boolean> = new Map(); // boolean is "valid"
  for (const [dropLoc, valid] of ctx.dropLocs) {
    if ((dropLoc.type === 'intoList') && (dropLoc.nodeId === parentNode.nid)) {
      dropIdxs.set(dropLoc.idx, valid);
    }
  }

  return <BlockVList childViews={childViews} dropIdxs={dropIdxs} parentNodeId={parentNode.nid} allowed="decl" />;
}

const StmtListView: React.FC<{stmts: ReadonlyArray<StmtNode>, parentNode: ASTNode, ctx: NodeViewCtx}> = ({stmts, parentNode, ctx}) => {
  const childViews = new Map(stmts.map(stmt => [stmt.nid, <NodeView key={stmt.nid} node={stmt} ctx={ctx} isListItem={true} allowed="stmt" />]));

  const dropIdxs: Map<number, boolean> = new Map(); // boolean is "valid"
  for (const [dropLoc, valid] of ctx.dropLocs) {
    if ((dropLoc.type === 'intoList') && (dropLoc.nodeId === parentNode.nid)) {
      dropIdxs.set(dropLoc.idx, valid);
    }
  }

  return <BlockVList childViews={childViews} dropIdxs={dropIdxs} parentNodeId={parentNode.nid} allowed="stmt" />;
}
