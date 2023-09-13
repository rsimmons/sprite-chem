import { invariant } from "../../../util";
import { ASTNode, NodeId, ProgramNode } from "../../types/code";
import { Analysis, OuterStaticEnv, analyzeProgram } from "./analysis";
import { DropLoc, progInsertListNode, progRemoveNode, progReplaceNode, progReplaceNodeId } from "./tree";

export type CodeEditorAction =
  {
    readonly type: 'replaceNode';
    readonly oldNode: ASTNode;
    readonly newNode: ASTNode;
  } | {
    readonly type: 'removeNodeForDrag';
    readonly node: ASTNode;
    readonly dragId: string; // so that we can set a potential drop if it is dropped before being moved
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

export type CodeEditorDispatch = React.Dispatch<CodeEditorAction>;

interface PotentialDrop {
  readonly potentialNode: ASTNode;
  readonly dropLoc: DropLoc;
  readonly valid: boolean;
}

export interface CodeEditorState {
  readonly program: ProgramNode;
  readonly potentialDrops: ReadonlyMap<string, PotentialDrop>; // key is dragId
  readonly outerEnv: OuterStaticEnv;
  readonly analysis: Analysis; // without UDFs there is only one static environment for now
}

function updateAnalysis(state: CodeEditorState): CodeEditorState {
  const analysis = analyzeProgram(state.program, state.outerEnv);
  invariant(analysis.errors.size === 0, 'program should be valid');
  return {
    ...state,
    analysis,
  };
}

function applyPotentialDrop(node: ASTNode, dropLoc: DropLoc, program: ProgramNode): ProgramNode {
  switch (dropLoc.type) {
    case 'ontoNode':
      return progReplaceNodeId(program, dropLoc.nodeId, node);

    case 'intoList':
      return progInsertListNode(program, dropLoc.nodeId, dropLoc.idx, node);
  }
}

function testPotentialDrop(node: ASTNode, dropLoc: DropLoc, program: ProgramNode, outerEnv: OuterStaticEnv): boolean {
  const testProgram = applyPotentialDrop(node, dropLoc, program);
  return (analyzeProgram(testProgram, outerEnv).errors.size === 0);
}

export function reducer(state: CodeEditorState, action: CodeEditorAction): CodeEditorState {
  switch (action.type) {
    case 'replaceNode': {
      const {oldNode, newNode} = action;

      return updateAnalysis({
        ...state,
        program: progReplaceNode(state.program, oldNode, newNode),
      });
    }

    case 'removeNodeForDrag': {
      const [newProgram, removedDropLoc] = progRemoveNode(state.program, action.node);

      const valid = testPotentialDrop(action.node, removedDropLoc, newProgram, state.outerEnv);

      const newPotentialDrops = new Map(state.potentialDrops);
      newPotentialDrops.set(action.dragId, {
        potentialNode: action.node,
        dropLoc: removedDropLoc,
        valid,
      });

      return updateAnalysis({
        ...state,
        program: newProgram,
        potentialDrops: newPotentialDrops,
      });
    }

    case 'setPotentialDrop': {
      const valid = testPotentialDrop(action.potentialNode, action.dropLoc, state.program, state.outerEnv);

      const newPotentialDrops = new Map(state.potentialDrops);
      newPotentialDrops.set(action.dragId, {
        potentialNode: action.potentialNode,
        dropLoc: action.dropLoc,
        valid,
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

        if (pd.valid) {
          const newProgram = applyPotentialDrop(pd.potentialNode, pd.dropLoc, state.program);

          return updateAnalysis({
            ...state,
            program: newProgram,
            potentialDrops: newPotentialDrops,
          });
        } else {
          return {
            ...state,
            potentialDrops: newPotentialDrops,
          };
        }
      } else {
        return state;
      }
    }
  }
}

