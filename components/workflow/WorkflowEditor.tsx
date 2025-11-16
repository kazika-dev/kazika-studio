'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import ImageInputNode from './ImageInputNode';
import ElevenLabsNode from './ElevenLabsNode';
import HiggsfieldNode from './HiggsfieldNode';
import Seedream4Node from './Seedream4Node';
import CharacterSheetNode from './CharacterSheetNode';
import RapidNode from './RapidNode';
import ComfyUINode from './ComfyUINode';
import PopcornNode from './PopcornNode';
import QwenImageNode from './QwenImageNode';
import NodeSettings from './NodeSettings';
import GeminiNodeSettings from './GeminiNodeSettings';
import NanobanaNodeSettings from './NanobanaNodeSettings';
import ImageInputNodeSettings from './ImageInputNodeSettings';
import ElevenLabsNodeSettings from './ElevenLabsNodeSettings';
import HiggsfieldNodeSettings from './HiggsfieldNodeSettings';
import Seedream4NodeSettings from './Seedream4NodeSettings';
import CharacterSheetNodeSettings from './CharacterSheetNodeSettings';
import RapidNodeSettings from './RapidNodeSettings';
import ComfyUINodeSettings from './ComfyUINodeSettings';
import PopcornNodeSettings from './PopcornNodeSettings';
import QwenImageNodeSettings from './QwenImageNodeSettings';
import Toolbar from './Toolbar';
import ExecutionPanel from './ExecutionPanel';
import FormConfigEditor from './FormConfigEditor';

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
  imageInput: ImageInputNode,
  elevenlabs: ElevenLabsNode,
  higgsfield: HiggsfieldNode,
  seedream4: Seedream4Node,
  characterSheet: CharacterSheetNode,
  rapid: RapidNode,
  comfyui: ComfyUINode,
  popcorn: PopcornNode,
  qwenImage: QwenImageNode,
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<number | undefined>(undefined);
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 初回ロード時にURLパラメータまたは最新のワークフローを自動読み込み
  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        // URLパラメータからworkflowIdを取得
        const workflowIdParam = searchParams.get('id');

        if (workflowIdParam) {
          // URLパラメータにIDがある場合は、そのワークフローを読み込む
          const workflowResponse = await fetch(`/api/workflows/${workflowIdParam}`);
          const workflowData = await workflowResponse.json();

          if (workflowData.success) {
            setNodes(workflowData.workflow.nodes || []);
            setEdges(workflowData.workflow.edges || []);
            setCurrentWorkflowId(workflowData.workflow.id);
            setCurrentWorkflowName(workflowData.workflow.name);
            console.log('Loaded workflow from URL:', workflowData.workflow.name);
          }
        } else {
          // URLパラメータにIDがない場合は、最新のワークフローを読み込む
          const response = await fetch('/api/workflows');
          const data = await response.json();

          if (data.success && data.workflows && data.workflows.length > 0) {
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
        }
      } catch (error) {
        console.error('Failed to load workflow:', error);
        // エラーの場合は初期状態のまま
      } finally {
        setIsInitialLoad(false);
      }
    };

    if (isInitialLoad) {
      loadWorkflow();
    }
  }, [isInitialLoad, searchParams, setNodes, setEdges]);

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
    (type: 'input' | 'process' | 'output' | 'gemini' | 'nanobana' | 'imageInput' | 'elevenlabs' | 'higgsfield' | 'seedream4' | 'characterSheet' | 'rapid' | 'comfyui' | 'popcorn' | 'qwenImage') => {
      const newNode: Node = {
        id: `node-${Date.now()}`, // 一意のIDを生成
        type: type === 'gemini' ? 'gemini' : type === 'nanobana' ? 'nanobana' : type === 'imageInput' ? 'imageInput' : type === 'elevenlabs' ? 'elevenlabs' : type === 'higgsfield' ? 'higgsfield' : type === 'seedream4' ? 'seedream4' : type === 'characterSheet' ? 'characterSheet' : type === 'rapid' ? 'rapid' : type === 'comfyui' ? 'comfyui' : type === 'popcorn' ? 'popcorn' : type === 'qwenImage' ? 'qwenImage' : 'custom',
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 400 + 100
        },
        data: {
          label: type === 'nanobana' ? 'Nanobana 画像生成' : type === 'gemini' ? 'Gemini AI' : type === 'imageInput' ? '画像入力' : type === 'elevenlabs' ? 'ElevenLabs TTS' : type === 'higgsfield' ? 'Higgsfield 動画生成' : type === 'seedream4' ? 'Seedream4 画像生成' : type === 'characterSheet' ? 'キャラクターシート' : type === 'rapid' ? 'Rapid 画像編集' : type === 'comfyui' ? 'ComfyUI ワークフロー' : type === 'popcorn' ? 'Popcorn 画像生成' : type === 'qwenImage' ? 'Qwen 画像生成' : type === 'input' ? '入力ノード' : type === 'process' ? '処理ノード' : '出力ノード',
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
          } : type === 'imageInput' ? {
            name: `画像入力${nodes.length + 1}`,
            description: '参照画像を設定します',
            imageData: null,
          } : type === 'elevenlabs' ? {
            name: `ElevenLabs ノード${nodes.length + 1}`,
            description: 'テキストを音声に変換します',
            text: '',
            voiceId: 'JBFqnCBsd6RMkjVDRZzb',
            modelId: 'eleven_multilingual_v2',
            status: 'idle',
          } : type === 'higgsfield' ? {
            name: `Higgsfield ノード${nodes.length + 1}`,
            description: '画像から動画を生成します（要：画像入力）',
            prompt: '',
            duration: 5,
            cfgScale: 0.5,
            enhancePrompt: false,
            negativePrompt: '',
            status: 'idle',
          } : type === 'seedream4' ? {
            name: `Seedream4 ノード${nodes.length + 1}`,
            description: '参照画像から新しい画像を生成します（要：画像入力）',
            prompt: '',
            aspectRatio: '4:3',
            quality: 'basic',
            status: 'idle',
          } : type === 'characterSheet' ? {
            name: `キャラクターシート${nodes.length + 1}`,
            description: 'キャラクターシートの画像を次のノードに送ります',
            characterSheet: null,
          } : type === 'rapid' ? {
            name: `Rapid ノード${nodes.length + 1}`,
            description: 'ComfyUI Rapidで画像を編集します（要：画像入力）',
            prompt: '',
            status: 'idle',
          } : type === 'comfyui' ? {
            name: `ComfyUI ノード${nodes.length + 1}`,
            description: 'ComfyUIワークフローを実行します',
            workflowName: '',
            workflowJson: null,
            prompt: '',
            status: 'idle',
          } : type === 'popcorn' ? {
            name: `Popcorn ノード${nodes.length + 1}`,
            description: 'Popcornで画像を生成します',
            prompt: '',
            aspectRatio: '3:4',
            count: 1,
            quality: '720p',
            presetId: '',
            enhancePrompt: false,
            status: 'idle',
          } : type === 'qwenImage' ? {
            name: `Qwen ノード${nodes.length + 1}`,
            description: 'Qwenで画像を生成します',
            prompt: '',
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
      // form_configはAPI側で自動生成されるため、クライアントからは送信しない
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
        // 新規作成の場合はURLを更新
        if (!currentWorkflowId) {
          router.push(`/workflow?id=${data.workflow.id}`);
        }
      } else {
        throw new Error(data.error);
      }
    },
    [currentWorkflowId, nodes, edges, router]
  );

  const handleWorkflowNameChange = useCallback((name: string) => {
    setCurrentWorkflowName(name);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', height: '100%', width: '100%', bgcolor: 'background.default' }}>
        <Box sx={{ flex: 1, position: 'relative' }}>
          <Toolbar onAddNode={addNode} />
          <Box
            sx={{
              position: 'absolute',
              top: 24,
              left: 290,
              zIndex: 10,
            }}
          >
            <FormConfigEditor nodes={nodes} />
          </Box>
          <ExecutionPanel
            nodes={nodes}
            edges={edges}
            onSave={handleSaveWorkflow}
            currentWorkflowId={currentWorkflowId}
            currentWorkflowName={currentWorkflowName}
            onWorkflowNameChange={handleWorkflowNameChange}
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
                switch (node.data.type || node.type) {
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
                  case 'imageInput':
                    return '#9c27b0';
                  case 'characterSheet':
                    return '#ff6b9d';
                  case 'rapid':
                    return '#9c27b0';
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
              nodes={nodes}
              edges={edges}
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
          ) : selectedNode.data.type === 'elevenlabs' ? (
            <ElevenLabsNodeSettings
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : selectedNode.data.type === 'higgsfield' ? (
            <HiggsfieldNodeSettings
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : selectedNode.data.type === 'seedream4' ? (
            <Seedream4NodeSettings
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : selectedNode.data.type === 'popcorn' ? (
            <PopcornNodeSettings
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : selectedNode.type === 'imageInput' ? (
            <ImageInputNodeSettings
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : selectedNode.type === 'characterSheet' ? (
            <CharacterSheetNodeSettings
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : selectedNode.type === 'rapid' ? (
            <RapidNodeSettings
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
            />
          ) : selectedNode.type === 'comfyui' ? (
            <ComfyUINodeSettings
              nodeId={selectedNode.id}
              config={selectedNode.data.config}
              onUpdate={updateNodeConfig}
              onClose={() => setSelectedNode(null)}
              onDelete={deleteNode}
            />
          ) : selectedNode.type === 'qwenImage' ? (
            <QwenImageNodeSettings
              nodeId={selectedNode.id}
              config={selectedNode.data.config}
              onUpdate={updateNodeConfig}
              onClose={() => setSelectedNode(null)}
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
