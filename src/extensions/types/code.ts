export type Name = string;

export type NodeId = string;

export interface HoleNode {
  readonly type: 'Hole';
  readonly nid: NodeId;
}

export interface LiteralNode {
  readonly type: 'Literal';
  readonly nid: NodeId;
  readonly subtype: 'number' | 'string' | 'boolean';
  readonly value: any;
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

export interface EmitNode {
  readonly type: 'Emit';
  readonly nid: NodeId;
  readonly evts: VarRefNode; // event var we are emitting to
  readonly expr: ValueExprNode; // the value we are emitting
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

export type StmtNode =
  | EqNode
  | EmitNode;

export type ASTNode =
  | DeclNode
  | ValueExprNode
  | BindExprNode
  | StmtNode
  | ProgramNode;

export interface Code {
  readonly decls: ReadonlyArray<DeclNode>;
}
