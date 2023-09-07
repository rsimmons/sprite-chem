import React, { useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Editor, EditorContext, PointerEventData } from '../../../extlib/editor';
import { genUidRandom, invariant } from '../../../util';
import { pointInRect } from '../../../vec';
import { ASTNode, Code, isBindExprNode, isDeclNode, isStmtNode, isValueExprNode, NodeId, VarNameNode } from '../../types/code';
import './codeEditor.css';
import { NodeView, ProgramView } from './components';
import { CodeEditorState, DropLoc, reducer } from './reducer';
import { outerEnv, analyzedPaletteNodes } from './template';
import { analyzeProgram } from './analysis';

const CodeEditor: React.FC<{editorCtx: EditorContext<Code, undefined>}> = ({editorCtx}) => {
  const [state, dispatch] = useReducer(reducer, null, (): CodeEditorState => {
    const program = editorCtx.initialValue;

    return {
      program,
      potentialDrops: new Map(),
      outerEnv,
      analysis: analyzeProgram(program, outerEnv),
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


  const handleDragMove = (e: Event) => {
    const ed = (e as CustomEvent<PointerEventData>).detail;
    invariant(ed);

    const matchesAllowed = (node: ASTNode, allowed: string) => {
      switch (allowed) {
        case 'decl':
          return isDeclNode(node);

        case 'stmt':
          return isStmtNode(node);

        case 'value':
          return isValueExprNode(node);

        case 'bind':
          return isBindExprNode(node);

        case 'none':
          return false;

        default:
          throw new Error('unimplemented: ' + allowed);
      }
    };

    const di = ed.dragInfo;

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
        e.preventDefault(); // indicate drag acceptance
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

  const handleDragDrop = (e: Event) => {
    const ed = (e as CustomEvent<PointerEventData>).detail;
    invariant(ed);

    const di = ed.dragInfo;
    dispatch({
      type: 'endDrag',
      dragId: di.dragId,
    });
  };

  useEffect(() => {
    editorCtx.pointerEventTarget.addEventListener('dragMove', handleDragMove);
    editorCtx.pointerEventTarget.addEventListener('dragDrop', handleDragDrop);
    return () => {
      editorCtx.pointerEventTarget.removeEventListener('dragMove', handleDragMove);
      editorCtx.pointerEventTarget.removeEventListener('dragDrop', handleDragDrop);
    };
  }, [handleDragMove, handleDragDrop]);

  return (
    <div
      className="CodeEditor"
      ref={editorRef}
    >
      <div className="CodeEditor-palette">
        {analyzedPaletteNodes.map(([node, analysis]) => (
          <NodeView
            key={node.nid}
            node={node}
            ctx={{
              kind: 'palette',
              analysis,
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
            analysis: state.analysis,
            dispatch,
            allowDrag: 'yes',
            editorCtx,
            dropLocs: [...state.potentialDrops.values()].map(info => [info.dropLoc, info.valid]),
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
