'use client';

import { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ThemeProvider, createTheme, Box, Fab, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

import CustomNode from './CustomNode';
import GeminiNode from './GeminiNode';
import NanobanaNode from './NanobanaNode';
import NodeSettings from './NodeSettings';
import GeminiNodeSettings from './GeminiNodeSettings';
import NanobanaNodeSettings from './NanobanaNodeSettings';
import Toolbar from './Toolbar';
import ExecutionPanel from './ExecutionPanel';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
    success: {
      main: '#2e7d32',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  shape: {
    borderRadius: 8,
  },
});

const nodeTypes = {
  custom: CustomNode,
  gemini: GeminiNode,
  nanobana: NanobanaNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: {
      label: '入力ノード',
      type: 'input',
      config: {
        name: '入力ノード1',
        description: 'データの入力を受け付けます',
      }
    },
  },
];

const initialEdges: Edge[] = [];

export default function WorkflowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<number | undefined>(undefined);
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 初回ロード時に最新のワークフローを自動読み込み
  useEffect(() => {
    const loadLatestWorkflow = async () => {
      try {
        const response = await fetch('/api/workflows');
        const data = await response.json();

        if (data.success && data.workflows && data.workflows.length > 0) {
          // 最新のワークフロー（一番最初のもの）を読み込む
          const latestWorkflow = data.workflows[0];
          const workflowResponse = await fetch(`/api/workflows/${latestWorkflow.id}`);
          const workflowData = await workflowResponse.json();

          if (workflowData.success) {
            setNodes(workflowData.workflow.nodes || []);
            setEdges(workflowData.workflow.edges || []);
            setCurrentWorkflowId(workflowData.workflow.id);
            setCurrentWorkflowName(workflowData.workflow.name);
            console.log('Loaded latest workflow:', workflowData.workflow.name);
          }
        } else {
          console.log('No saved workflows found, using initial state');
        }
      } catch (error) {
        console.error('Failed to load latest workflow:', error);
        // エラーの場合は初期状態のまま
      } finally {
        setIsInitialLoad(false);
      }
    };

    if (isInitialLoad) {
      loadLatestWorkflow();
    }
  }, [isInitialLoad, setNodes, setEdges]);

  // ノード更新イベントのリスナー
  useEffect(() => {
    const handleNodeUpdate = (event: any) => {
      const { id, updates } = event.detail;
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...updates } }
            : node
        )
      );
    };

    window.addEventListener('update-node', handleNodeUpdate);
    return () => {
      window.removeEventListener('update-node', handleNodeUpdate);
    };
  }, [setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);

    // 全てのエッジのスタイルをリセット
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          strokeWidth: 2,
          stroke: '#90caf9',
        },
        animated: false,
      }))
    );
  }, [setEdges]);

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge);
      setSelectedNode(null);

      // 選択されたエッジのスタイルを更新
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id
            ? {
                ...e,
                style: {
                  ...e.style,
                  stroke: '#f44336',
                  strokeWidth: 3,
                },
                animated: true,
              }
            : {
                ...e,
                style: {
                  strokeWidth: 2,
                  stroke: '#90caf9',
                },
                animated: false,
              }
        )
      );
    },
    [setEdges]
  );

  const deleteEdge = useCallback(() => {
    if (selectedEdge) {
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdge.id));
      setSelectedEdge(null);
    }
  }, [selectedEdge, setEdges]);

  const addNode = useCallback(
    (type: 'input' | 'process' | 'output' | 'gemini' | 'nanobana') => {
      const newNode: Node = {
        id: `node-${Date.now()}`, // 一意のIDを生成
        type: type === 'gemini' ? 'gemini' : type === 'nanobana' ? 'nanobana' : 'custom',
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 400 + 100
        },
        data: {
          label: type === 'nanobana' ? 'Nanobana 画像生成' : type === 'gemini' ? 'Gemini AI' : type === 'input' ? '入力ノード' : type === 'process' ? '処理ノード' : '出力ノード',
          type,
          config: type === 'nanobana' ? {
            name: `Nanobana ノード${nodes.length + 1}`,
            description: 'Nanobanaで画像を生成します',
            prompt: '',
            aspectRatio: '1:1',
            status: 'idle',
          } : type === 'gemini' ? {
            name: `Gemini ノード${nodes.length + 1}`,
            description: 'Gemini AIに問い合わせます',
            prompt: '',
            model: 'gemini-2.5-flash',
            status: 'idle',
          } : {
            name: `${type === 'input' ? '入力' : type === 'process' ? '処理' : '出力'}ノード${nodes.length + 1}`,
            description: '',
          }
        },
      };
      console.log('Adding node:', newNode);
      setNodes((nds) => {
        const updatedNodes = [...nds, newNode];
        console.log('Updated nodes:', updatedNodes);
        return updatedNodes;
      });
    },
    [nodes.length, setNodes]
  );

  const deleteNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) => eds.filter(
        (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  // キーボードショートカット（Delete/Backspace）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // 入力フィールドにフォーカスがある場合は無視
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        if (selectedEdge) {
          event.preventDefault();
          deleteEdge();
        } else if (selectedNode) {
          event.preventDefault();
          deleteNode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedEdge, selectedNode, deleteEdge, deleteNode]);

  const updateNodeConfig = useCallback(
    (nodeId: string, config: any) => {
      console.log('Updating node config:', { nodeId, config });
      setNodes((nds) => {
        const updated = nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, config } }
            : node
        );
        console.log('Updated nodes:', updated.find(n => n.id === nodeId));
        return updated;
      });
    },
    [setNodes]
  );

  const handleSaveWorkflow = useCallback(
    async (name: string, description: string) => {
      const method = currentWorkflowId ? 'PUT' : 'POST';
      const body = currentWorkflowId
        ? { id: currentWorkflowId, name, description, nodes, edges }
        : { name, description, nodes, edges };

      const response = await fetch('/api/workflows', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        setCurrentWorkflowId(data.workflow.id);
        setCurrentWorkflowName(name);
      } else {
        throw new Error(data.error);
      }
    },
    [currentWorkflowId, nodes, edges]
  );

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', height: '100%', width: '100%', bgcolor: 'background.default' }}>
        <Box sx={{ flex: 1, position: 'relative' }}>
          <Toolbar onAddNode={addNode} />
          <ExecutionPanel
            nodes={nodes}
            edges={edges}
            onSave={handleSaveWorkflow}
            currentWorkflowId={currentWorkflowId}
            currentWorkflowName={currentWorkflowName}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{
              style: { strokeWidth: 2, stroke: '#90caf9' },
              type: 'smoothstep',
              animated: false,
            }}
            deleteKeyCode={null}
          >
            <Controls
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                switch (node.data.type) {
                  case 'input':
                    return '#1976d2';
                  case 'process':
                    return '#2e7d32';
                  case 'output':
                    return '#9c27b0';
                  case 'gemini':
                    return '#ea80fc';
                  case 'nanobana':
                    return '#ff6b9d';
                  default:
                    return '#999';
                }
              }}
              style={{
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
              }}
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="#e0e0e0"
            />
          </ReactFlow>

          {/* エッジ削除ボタン */}
          {selectedEdge && (
            <Tooltip title="接続を削除 (Deleteキー)" placement="left">
              <Fab
                color="error"
                size="medium"
                onClick={deleteEdge}
                sx={{
                  position: 'absolute',
                  bottom: 24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                }}
              >
                <DeleteIcon />
              </Fab>
            </Tooltip>
          )}
        </Box>
        {selectedNode && (
          selectedNode.data.type === 'nanobana' ? (
            <NanobanaNodeSettings
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : selectedNode.data.type === 'gemini' ? (
            <GeminiNodeSettings
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : (
            <NodeSettings
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          )
        )}
      </Box>
    </ThemeProvider>
  );
}
