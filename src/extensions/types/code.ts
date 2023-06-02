import { LoaderSaver } from "../../extlib/common";

export type Name = string;

export type NodeId = string;

export interface HoleNode {
  readonly type: 'Hole';
  readonly nid: NodeId;
}

// note that we don't allow applying arbitrary expressions, to simplify for now
export interface FnAppNode {
  readonly type: 'FnApp';
  readonly nid: NodeId;
  readonly fn: NodeId;
  readonly args: ReadonlyMap<string, ValueExprNode>; // maps parameter id to expr
}

export interface WhenNode {
  readonly type: 'When';
  readonly nid: NodeId;
  readonly evts: ValueExprNode;
  readonly stmts: ReadonlyArray<StmtNode>;
}

export interface VarRefNode {
  readonly type: 'VarRef';
  readonly nid: NodeId;
  readonly refId: NodeId;
}

export interface VarBindNode {
  readonly type: 'VarBind';
  readonly nid: NodeId;
  readonly name: Name;
}

export interface EqNode {
  readonly type: 'Eq';
  readonly nid: NodeId;
  readonly lhs: BindExprNode;
  readonly rhs: ValueExprNode;
}

export interface EmitNode {
  readonly type: 'Emit';
  readonly nid: NodeId;
  readonly evts: VarRefNode; // event var we are emitting to
  readonly expr: ValueExprNode; // the value we are emitting
}

export type DeclNode =
  | WhenNode
  | EqNode;
export function isDeclNode(node: ASTNode): node is DeclNode {
  return (node.type === 'When') || (node.type === 'Eq');
}

export type ValueExprNode =
  | HoleNode
  | VarRefNode
  | FnAppNode;

export type BindExprNode =
  | VarBindNode
  | HoleNode;

export type StmtNode =
  | EqNode
  | EmitNode;

export type ASTNode =
  | DeclNode
  | ValueExprNode
  | BindExprNode
  | StmtNode;

export interface Code {
  readonly decls: ReadonlyArray<DeclNode>;
}

export const loaderSaver: LoaderSaver<Code> = {
  load: (state) => { throw new Error('unimplemented'); },
  save: (val) => { throw new Error('unimplemented'); },
}
