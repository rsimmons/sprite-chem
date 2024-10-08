import { EVWrapper } from "../../extlib/ev";

export type Name = string;

export type NodeId = string;

export interface HoleNode {
  readonly type: 'Hole';
  readonly nid: NodeId;
}

export interface LiteralNode {
  readonly type: 'Literal';
  readonly nid: NodeId;
  readonly sub:
    | { readonly type: 'number'; readonly value: number }
    | { readonly type: 'text'; readonly value: string }
    | { readonly type: 'boolean'; readonly value: boolean }
    | { readonly type: 'ev'; readonly value: EVWrapper<any> }
    ;
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
export function isWhenNode(node: ASTNode): node is WhenNode {
  return (node.type === 'When');
}

export interface VarRefNode {
  readonly type: 'VarRef';
  readonly nid: NodeId;
  readonly refId: NodeId;
}
export function isVarRefNode(node: ASTNode): node is VarRefNode {
  return (node.type === 'VarRef');
}

export interface VarNameNode {
  readonly type: 'VarName';
  readonly nid: NodeId;
  readonly name: Name;
}

export interface EqNode {
  readonly type: 'Eq';
  readonly nid: NodeId;
  readonly lhs: BindExprNode;
  readonly rhs: ValueExprNode;
}

// emit a "unit type" value, which is just a signal that something happened
export interface EmitUnitNode {
  readonly type: 'EmitUnit';
  readonly nid: NodeId;
  readonly evts: MutTargetNode; // event var we are emitting to
}

export interface EmitValueNode {
  readonly type: 'EmitValue';
  readonly nid: NodeId;
  readonly evts: MutTargetNode; // event var we are emitting to
  readonly expr: ValueExprNode;
}

export type EmitNode = EmitUnitNode | EmitValueNode;
export function isEmitNode(node: ASTNode): node is EmitNode {
  return (node.type === 'EmitUnit') || (node.type === 'EmitValue');
}

export interface ProgramNode {
  readonly type: 'Program';
  readonly nid: NodeId;
  readonly decls: ReadonlyArray<DeclNode>;
}
export function isProgramNode(node: ASTNode): node is ProgramNode {
  return (node.type === 'Program');
}

export type DeclNode =
  | WhenNode
  | EqNode
export function isDeclNode(node: ASTNode): node is DeclNode {
  return (node.type === 'When') || (node.type === 'Eq');
}

export type ValueExprNode =
  | HoleNode
  | LiteralNode
  | VarRefNode
  | FnAppNode;
export function isValueExprNode(node: ASTNode): node is ValueExprNode {
  return (node.type === 'Hole') || (node.type === 'Literal') || (node.type === 'VarRef') || (node.type === 'FnApp');
}

export type BindExprNode =
  | VarNameNode
  | VarRefNode // for setting named returns
  | HoleNode;
export function isBindExprNode(node: ASTNode): node is BindExprNode {
  return (node.type === 'VarName') || (node.type === 'VarRef') || (node.type === 'Hole');
}

export type MutTargetNode =
  | VarRefNode
  | HoleNode;
export function isMutTargetNode(node: ASTNode): node is MutTargetNode {
  return (node.type === 'VarRef') || (node.type === 'Hole');
}

export type StmtNode =
  | EqNode
  | EmitUnitNode
  | EmitValueNode;
export function isStmtNode(node: ASTNode): node is StmtNode {
  return (node.type === 'Eq') || (node.type === 'EmitUnit') || (node.type === 'EmitValue');
}

export type ASTNode =
  | DeclNode
  | ValueExprNode
  | BindExprNode
  | StmtNode
  | ProgramNode;

export interface Code {
  program: ProgramNode;
  inactiveNodes: ReadonlySet<NodeId>;
}
