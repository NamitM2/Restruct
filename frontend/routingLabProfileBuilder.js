const React = window.React;
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const { createRoot } = window.ReactDOM;

const controllerListeners = [];
function subscribeToController(callback) {
    controllerListeners.push(callback);
    return () => {
        const index = controllerListeners.indexOf(callback);
        if (index > -1) controllerListeners.splice(index, 1);
    };
}

const overlayController = {
    open: (options = {}) => {
        const overlay = document.getElementById('profileBuilderOverlay');
        if (overlay) {
            overlay.classList.add('active');
            controllerListeners.forEach(listener => listener({ type: 'open', options }));
        }
    },
    close: () => {
        const overlay = document.getElementById('profileBuilderOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        controllerListeners.forEach(listener => listener({ type: 'close' }));
    },
    subscribe: subscribeToController
};

window.profileBuilderOverlay = overlayController;

const siteColors = {
    cost: '#c98454',
    quality: '#b56747',
    latency: '#8e3c2c',
    router: '#5b2a1a',
    edgeIdle: 'rgba(92, 49, 30, 0.25)',
};

// Custom terracotta cursors
const defaultCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='8' fill='none' stroke='%238e3c2c' stroke-width='2'/%3E%3C/svg%3E") 10 10, auto`;
const activeCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='8' fill='%238e3c2c' stroke='%238e3c2c' stroke-width='2'/%3E%3C/svg%3E") 10 10, auto`;

// Global cursor styles injected once
const cursorStyles = `
  * { cursor: ${defaultCursor} !important; }
  *:active { cursor: ${activeCursor} !important; }
  input:focus, textarea:focus { cursor: text !important; }
  input:focus, textarea:focus, select:focus {
    outline: none !important;
    border-color: #b56747 !important;
    box-shadow: 0 0 0 2px rgba(92, 49, 30, 0.15) !important;
  }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; }
`;

const providerPresets = [
    { id: 'openai', label: 'OpenAI', icon: 'O', models: ['GPT-4o', 'GPT-4o mini', 'o1-preview'] },
    { id: 'anthropic', label: 'Anthropic', icon: 'A', models: ['Claude 3 Opus', 'Claude 3 Haiku', 'Claude 3.5 Sonnet'] },
    { id: 'google', label: 'Google', icon: 'G', models: ['Gemini 2.5 Pro', 'Gemini 1.5 Flash', 'Gemini Nano'] },
    { id: 'mistral', label: 'Mistral', icon: 'M', models: ['Mistral Large', 'Mistral Small', 'Mixtral 8x7b'] },
    { id: 'qwen', label: 'Qwen', icon: 'Q', models: ['Qwen 2.5', 'Qwen 2'] },
    { id: 'local', label: 'Local Models', icon: 'L', models: ['Local'], color: '#8e3c2c', isLocal: true },
];

const defaultWeights = [
    { id: 'quality', label: 'Quality', weight: 0.45 },
    { id: 'cost', label: 'Cost', weight: 0.35 },
    { id: 'latency', label: 'Latency', weight: 0.20 },
];

const defaultHardLimits = {
    maxCostPerCall: null,
    maxOutputTokens: null,
    dailySpendLimit: null,
    dailyOutputTokens: null,
};

const ruleConditions = [
    { id: 'tokenCount', label: 'token count' },
    { id: 'promptContains', label: 'prompt contains' },
    { id: 'expectedOutputTokens', label: 'expected output tokens' },
];

const ruleActions = [
    { id: 'preferCheap', label: 'prefer cheap models' },
    { id: 'boostClaude', label: 'boost Claude Code' },
    { id: 'useGpt4oOpus', label: 'use GPT-4o or Claude Opus' },
];

const codeFlowModels = [
    { name: 'Claude Opus 4.5', logo: 'assets/claude-logo.png' },
    { name: 'Sonnet 4.5', logo: 'assets/claude-logo.png' },
    { name: 'Gemini 3 Pro', logo: 'assets/gemini-logo.png' },
    { name: 'GPT 5.1 Codex Max', logo: 'assets/chatgpt-logo.png' },
    { name: 'GPT 5.1 Codex', logo: 'assets/chatgpt-logo.png' },
    { name: 'Claude Sonnet 4.5 (Thinking)', logo: 'assets/claude-logo.png' },
    { name: 'GPT 5.1', logo: 'assets/chatgpt-logo.png' },
    { name: 'Mistral Large 2', logo: 'assets/mistral-logo.png' },
    { name: 'Qwen Max', logo: 'assets/qwen-logo.png' }
];

function CodeFlowBuilder({ onDismiss, initialOptions }) {
    // Initial nodes based on default flow or passed options
    const initialNodes = [
        { id: 'user-prompt', label: 'Your Prompt', desc: 'Starting input', x: 100, y: 200, model: null, isStart: true },
        { id: 'planning', label: 'Planning', desc: 'Analyzes requirements & creates architecture', x: 500, y: 200, model: initialOptions?.profile?.flow?.planning || null },
        { id: 'execution', label: 'Execution', desc: 'Writes the actual code implementation', x: 900, y: 200, model: initialOptions?.profile?.flow?.execution || null },
        { id: 'verification', label: 'Verification', desc: 'Reviews code & fixes security issues', x: 700, y: 500, model: initialOptions?.profile?.flow?.verification || null }
    ];

    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState([
        { from: 'user-prompt', to: 'planning' },
        { from: 'planning', to: 'execution' },
        { from: 'execution', to: 'verification' },
        { from: 'verification', to: 'planning', condition: 'fails' }
    ]);

    const [draggedNode, setDraggedNode] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [connectingNode, setConnectingNode] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    // Removed rightPanelTab, draggedModel, newNodeLabel, etc. as they are no longer used in the main flow

    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [isPanning, setIsPanning] = useState(false);

    const canvasRef = useRef(null);

    // Inject custom cursor styles
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = cursorStyles;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // --- Node Dragging Logic (Simple Mouse Events) ---
    // We are reverting to simple onMouseMove/onMouseUp on the container to avoid pointer capture issues

    // --- Node Dragging & Connection Logic (Window Listeners) ---
    const dragRef = useRef({
        isDragging: false,
        isConnecting: false,
        nodeId: null,
        offsetX: 0,
        offsetY: 0
    });

    const handleWindowMouseMove = useCallback((e) => {
        if (!canvasRef.current) return;

        // Safety check for ref content
        if (!dragRef.current) return;

        const { isDragging, isConnecting, isPanning, nodeId, offsetX, offsetY, startX, startY, initialTransform, hasMoved } = dragRef.current;

        if (isPanning) {
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            setTransform({ ...initialTransform, x: initialTransform.x + dx, y: initialTransform.y + dy });
            return;
        }

        if (isDragging && nodeId) {
            e.preventDefault();

            // Check for movement to distinguish click vs drag
            if (!hasMoved) {
                const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
                if (dist > 5) {
                    dragRef.current.hasMoved = true;
                }
            }

            const rect = canvasRef.current.getBoundingClientRect();
            // Apply inverse transform to mouse coordinates
            const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
            const mouseY = (e.clientY - rect.top - transform.y) / transform.k;

            setNodes(prev => {
                return prev.map(n => {
                    if (n.id === nodeId) {
                        return { ...n, x: mouseX - offsetX, y: mouseY - offsetY };
                    }
                    return n;
                });
            });
        }

        if (isConnecting) {
            const rect = canvasRef.current.getBoundingClientRect();
            // Apply inverse transform to mouse coordinates
            const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
            const mouseY = (e.clientY - rect.top - transform.y) / transform.k;
            setMousePos({ x: mouseX, y: mouseY });
        }
    }, [transform]);

    const handleWindowMouseUp = useCallback((e) => {
        const { isDragging, isConnecting, isPanning, hasMoved, nodeId } = dragRef.current;
        if (isDragging || isConnecting || isPanning) {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);

            // Reset cursor
            document.body.style.cursor = '';

            if (isPanning) setIsPanning(false);

            // Handle Click (Select Node)
            if (isDragging && !hasMoved && nodeId) {
                setSelectedNodeId(nodeId);
            }

            dragRef.current = { isDragging: false, isConnecting: false, isPanning: false, nodeId: null, offsetX: 0, offsetY: 0 };
            setDraggedNode(null);
            setConnectingNode(null);
        }
    }, [handleWindowMouseMove]);

    // Cleanup listeners on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            document.body.style.cursor = ''; // Ensure cursor is reset
        };
    }, [handleWindowMouseMove, handleWindowMouseUp]);

    const handleMouseDown = (e, nodeId) => {
        e.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (!node || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        // Apply inverse transform
        const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
        const mouseY = (e.clientY - rect.top - transform.y) / transform.k;

        dragRef.current = {
            isDragging: true,
            isConnecting: false,
            nodeId: nodeId,
            offsetX: mouseX - node.x,
            offsetY: mouseY - node.y,
            startX: e.clientX,
            startY: e.clientY,
            hasMoved: false
        };

        // Set global cursor for professional feel
        document.body.style.cursor = 'grabbing';

        setDraggedNode(nodeId);
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    };

    // Old handlers removed - replaced by window listeners
    const handleMouseMove = () => { };
    const handleMouseUp = () => { };

    const startConnection = (e, nodeId) => {
        e.stopPropagation();
        e.preventDefault();

        dragRef.current = {
            isDragging: false,
            isConnecting: true,
            nodeId: nodeId,
            offsetX: 0,
            offsetY: 0
        };

        setConnectingNode(nodeId);

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    };

    const handleCanvasDragOver = (e) => {
        e.preventDefault(); // Allow dropping models
    };

    const handleCanvasDrop = (e) => {
        // Only handle model drops if needed
    };

    // Handle connections


    const completeConnection = (e, targetNodeId) => {
        // Do NOT stop propagation here, or the window mouseUp listener won't fire, causing stuck dragging.
        // e.stopPropagation(); 

        if (connectingNode && connectingNode !== targetNodeId) {
            // Check if edge already exists
            if (!edges.find(edge => edge.from === connectingNode && edge.to === targetNodeId)) {
                setEdges(prev => [...prev, { from: connectingNode, to: targetNodeId }]);
            }
        }
        setConnectingNode(null);
    };

    // Add Custom Node
    const addCustomNode = () => {
        if (!newNodeLabel.trim()) return;
        const id = `custom-${Date.now()}`;
        const newNode = {
            id,
            label: newNodeLabel,
            desc: newNodeDesc || 'Custom processing step',
            prompt: newNodePrompt,
            x: 400, // Default center
            y: 300,
            model: null,
            isCustom: true
        };
        setNodes(prev => [...prev, newNode]);
        setNewNodeLabel('');
        setNewNodeDesc('');
        setNewNodePrompt('');
        // Switch back to models tab or stay? Stay for now.
    };

    // Delete Node
    // Delete Node
    const deleteNode = (e, nodeId) => {
        e.stopPropagation();
        const nodeToDelete = nodes.find(n => n.id === nodeId);

        setNodes(prev => prev.filter(n => n.id !== nodeId));

        // Update edges to preserve "broken" state instead of removing them
        setEdges(prev => prev.map(edge => {
            if (edge.from === nodeId) {
                return { ...edge, fromNodeMissing: true, ghostFrom: { x: nodeToDelete.x, y: nodeToDelete.y } };
            }
            if (edge.to === nodeId) {
                return { ...edge, toNodeMissing: true, ghostTo: { x: nodeToDelete.x, y: nodeToDelete.y } };
            }
            return edge;
        }));
    };

    // Split Edge to Add Condition
    const splitEdge = (edge, midX, midY) => {
        const newId = `condition-${Date.now()}`;
        const newNode = {
            id: newId,
            label: 'Condition',
            desc: 'Check',
            condition: 'If criteria met',
            x: midX - 120, // Center the node (width 240/2 = 120)
            y: midY - 60,  // Center the node (height ~120/2 = 60)
            isCondition: true,
            model: null
        };

        setNodes(prev => [...prev, newNode]);
        setEdges(prev => {
            const newEdges = prev.filter(e => e !== edge);
            newEdges.push({ from: edge.from, to: newId });
            newEdges.push({ from: newId, to: edge.to });
            return newEdges;
        });
        setSelectedNodeId(newId);
    };

    const handleSave = () => {
        // Construct flow object based on nodes and edges
        // For backward compatibility, we might want to map back to planning/execution/verification if they exist
        // But for the new flexible graph, we should save the graph structure.
        // Assuming the backend can handle a graph or we map known IDs.

        const flowData = {
            nodes: nodes.map(({ id, label, desc, prompt, model, x, y }) => ({ id, label, desc, prompt, model, x, y })),
            edges
        };

        if (initialOptions?.onSave) {
            initialOptions.onSave({
                name: initialOptions?.profile?.name || 'Code Flow',
                flow: flowData, // Pass full graph data
                // Also pass legacy format for simple flows if needed by current backend
                planning: nodes.find(n => n.id === 'planning')?.model,
                execution: nodes.find(n => n.id === 'execution')?.model,
                verification: nodes.find(n => n.id === 'verification')?.model
            });
        }
        onDismiss();
    };

    const getModelLogo = (modelName) => {
        const model = codeFlowModels.find(m => m.name === modelName);
        return model ? model.logo : 'assets/models-icon.png';
    };

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey || true) { // Always zoom on wheel for now
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const newZoom = Math.min(Math.max(0.1, transform.k - e.deltaY * zoomSensitivity), 5);
            setTransform(prev => ({ ...prev, k: newZoom }));
        }
    };

    const handleCanvasMouseDown = (e) => {
        // Start panning
        if (e.button === 0) { // Left click on background
            dragRef.current = {
                isDragging: false,
                isConnecting: false,
                isPanning: true,
                startX: e.clientX,
                startY: e.clientY,
                initialTransform: { ...transform }
            };
            setIsPanning(true);
            document.body.style.cursor = 'grabbing';
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }
    };

    return React.createElement('div', {
        className: 'fixed inset-0 z-50 flex flex-col bg-white animate-fade-in',
        style: { fontFamily: "'Space Grotesk', sans-serif" }
    }, [
        // Header
        React.createElement('header', {
            className: 'h-16 border-b flex items-center justify-between px-6 bg-white z-20 relative shadow-sm',
            style: { borderColor: 'var(--border-subtle)' }
        }, [
            React.createElement('div', { className: 'flex items-center gap-3' }, [
                React.createElement('div', {
                    className: 'w-8 h-8 rounded-lg flex items-center justify-center',
                    style: { background: 'var(--accent-primary)', color: 'white' }
                }, '⚡'),
                React.createElement('h1', { className: 'font-bold text-lg' }, 'Code Flow Designer')
            ]),
            React.createElement('div', { className: 'flex items-center gap-3' }, [
                React.createElement('div', { className: 'text-sm text-muted mr-4' }, 'Scroll to zoom • Drag to pan'),
                React.createElement('button', {
                    onClick: onDismiss,
                    className: 'px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors',
                    style: { color: 'var(--text-secondary)' }
                }, 'Exit'),
                React.createElement('button', {
                    onClick: handleSave,
                    className: 'px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5',
                    style: { background: 'var(--gradient-terra)' }
                }, 'Save Flow')
            ])
        ]),

        // Main Canvas Area
        React.createElement('div', {
            className: 'flex-1 relative overflow-hidden bg-dot-pattern',
            ref: canvasRef,
            onWheel: handleWheel,
            onMouseDown: handleCanvasMouseDown,
            style: { cursor: isPanning ? 'grabbing' : 'grab' }
        }, [
            React.createElement(MeshLensBackground, {}),

            // Floating UI (Fixed position)
            React.createElement('button', {
                className: 'absolute top-6 left-6 z-10 px-4 py-3 rounded-xl bg-white shadow-lg border border-clay-100 flex items-center gap-2 hover:scale-105 transition-transform font-medium text-clay-700',
                onMouseDown: (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Create new node immediately
                    const id = `node-${Date.now()}`;
                    const rect = canvasRef.current.getBoundingClientRect();

                    // Calculate position relative to canvas (start somewhat near top-left or mouse)
                    // Apply inverse transform
                    const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
                    const mouseY = (e.clientY - rect.top - transform.y) / transform.k;

                    const newNode = {
                        id,
                        label: 'New Node',
                        desc: 'Configure this step',
                        prompt: '',
                        x: mouseX - 120, // Center horizontally (width 240)
                        y: mouseY - 60,  // Center vertically
                        model: null
                    };

                    setNodes(prev => [...prev, newNode]);

                    // Start dragging immediately
                    dragRef.current = {
                        isDragging: true,
                        isConnecting: false,
                        nodeId: id,
                        offsetX: 120, // Center offset
                        offsetY: 60
                    };

                    document.body.style.cursor = 'grabbing';
                    setDraggedNode(id);
                    window.addEventListener('mousemove', handleWindowMouseMove);
                    window.addEventListener('mouseup', handleWindowMouseUp);
                }
            }, [
                React.createElement('span', { className: 'font-bold text-sm', style: { color: 'var(--text-primary)' } }, 'Drag to add node')
            ]),

            // Transform Container Content (Edges and Nodes)
            React.createElement('div', {
                style: {
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none' // Let clicks pass through to canvas for panning, but enable for children
                }
            }, [
                // SVG Layer for Edges
                React.createElement('svg', {
                    className: 'absolute inset-0 pointer-events-none z-0',
                    style: { width: '100%', height: '100%', overflow: 'visible' }
                }, [
                    // Edges
                    ...edges.map((edge, i) => {
                        const fromNode = nodes.find(n => n.id === edge.from);
                        const toNode = nodes.find(n => n.id === edge.to);

                        // Handle missing nodes (broken edges)
                        let x1, y1, x2, y2;
                        let isBroken = false;

                        if (fromNode) {
                            x1 = fromNode.x + 120;
                            y1 = fromNode.y + 60;
                        } else if (edge.ghostFrom) {
                            x1 = edge.ghostFrom.x + 120;
                            y1 = edge.ghostFrom.y + 60;
                            isBroken = true;
                        } else {
                            return null; // Should not happen if logic is correct
                        }

                        if (toNode) {
                            x2 = toNode.x + 120;
                            y2 = toNode.y + 60;
                        } else if (edge.ghostTo) {
                            x2 = edge.ghostTo.x + 120;
                            y2 = edge.ghostTo.y + 60;
                            isBroken = true;
                        } else {
                            return null;
                        }

                        const pathD = getCurvedPath(x1, y1, x2, y2);
                        const midX = (x1 + x2) / 2;
                        const midY = (y1 + y2) / 2; // Approximate mid for label

                        return React.createElement('g', { key: i }, [
                            React.createElement('path', {
                                id: `edge-path-${i}`,
                                d: pathD,
                                stroke: isBroken ? '#ef4444' : (edge.condition ? 'var(--accent-primary)' : 'var(--clay-400)'),
                                strokeWidth: '2',
                                fill: 'none',
                                strokeDasharray: edge.condition ? '5 5' : '8 8',
                                strokeOpacity: isBroken ? '0.8' : '0.6'
                            }),
                            // Directional Arrows
                            !isBroken && React.createElement('text', {
                                dy: 6, // Center vertically (adjusted for larger font)
                                fill: edge.condition ? 'var(--accent-primary)' : 'var(--clay-400)',
                                fontSize: '20',
                                style: { pointerEvents: 'none', opacity: 0.8 }
                            }, React.createElement('textPath', {
                                href: `#edge-path-${i}`,
                                startOffset: '20px', // Start a bit in
                                style: { letterSpacing: '20px' }
                            }, '➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤ ➤')),
                            // Condition Label
                            edge.condition && !isBroken && React.createElement('foreignObject', {
                                x: midX - 40,
                                y: midY - 12,
                                width: 80,
                                height: 24,
                                style: { overflow: 'visible' }
                            }, React.createElement('div', {
                                className: 'px-2 py-0.5 rounded-md text-[10px] font-bold text-center border shadow-sm',
                                style: {
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--accent-primary)',
                                    borderColor: 'var(--accent-primary)'
                                }
                            }, edge.condition)),
                            // Broken Edge Label
                            isBroken && React.createElement('foreignObject', {
                                x: midX - 50,
                                y: midY - 12,
                                width: 100,
                                height: 24,
                                style: { overflow: 'visible' }
                            }, React.createElement('div', {
                                className: 'px-2 py-0.5 rounded-md text-[10px] font-bold text-center border shadow-sm bg-red-50 text-red-600 border-red-200'
                            }, 'No connection')),
                            // Split Handle (Add Condition)
                            !isBroken && !edge.condition && React.createElement('foreignObject', {
                                x: midX - 10,
                                y: midY - 10,
                                width: 20,
                                height: 20,
                                style: { overflow: 'visible' }
                            }, React.createElement('button', {
                                className: 'w-5 h-5 rounded-full bg-white border border-clay-400 flex items-center justify-center text-clay-600 hover:bg-clay-50 hover:scale-110 transition-all shadow-sm cursor-pointer',
                                title: 'Add Condition Node',
                                onClick: (e) => {
                                    e.stopPropagation();
                                    splitEdge(edge, midX, midY);
                                }
                            }, '+'))
                        ]);
                    }),
                    // Active Connection Line
                    connectingNode && (() => {
                        const fromNode = nodes.find(n => n.id === connectingNode);
                        if (!fromNode) return null;

                        const x1 = fromNode.x + 120;
                        const y1 = fromNode.y + 60;
                        const x2 = mousePos.x;
                        const y2 = mousePos.y;

                        return React.createElement('path', {
                            d: getCurvedPath(x1, y1, x2, y2),
                            stroke: 'var(--clay-600)',
                            strokeWidth: '2',
                            fill: 'none',
                            strokeDasharray: '5 5'
                        });
                    })()
                ]),

                // Nodes
                nodes.map(node => {
                    const isActive = !!node.model;

                    // Conditional Node Rendering
                    if (node.isCondition) {
                        return React.createElement('div', {
                            key: node.id,
                            className: 'absolute flex items-center justify-center z-10 group',
                            style: {
                                left: node.x,
                                top: node.y,
                                width: '200px', // Square container for rotation
                                height: '200px',
                                cursor: draggedNode === node.id ? 'grabbing' : 'grab',
                                userSelect: 'none',
                                pointerEvents: 'auto'
                            },
                            onMouseDown: (e) => handleMouseDown(e, node.id),
                            onMouseUp: (e) => completeConnection(e, node.id)
                        }, [
                            // Diamond Shape
                            React.createElement('div', {
                                className: 'w-32 h-32 rotate-45 border-2 shadow-lg transition-all duration-300 flex items-center justify-center relative group-hover:border-clay-500 group-hover:shadow-xl',
                                style: {
                                    borderColor: 'var(--accent-primary)',
                                    backgroundColor: 'var(--bg-elevated)',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                }
                            }, [
                                // Un-rotate content container
                                React.createElement('div', {
                                    className: '-rotate-45 flex flex-col items-center justify-center p-2 text-center w-full h-full'
                                }, [
                                    React.createElement('span', { className: 'text-3xl font-bold mb-1', style: { color: 'var(--accent-primary)' } }, '?'),
                                    React.createElement('span', { className: 'text-xs font-medium leading-tight line-clamp-3 px-2', style: { color: 'var(--text-primary)' } }, node.condition || 'Condition')
                                ])
                            ]),

                            // Actions (Floating) - Visible on hover
                            React.createElement('div', {
                                className: 'absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full shadow-md px-3 py-1.5 border z-20',
                                style: { borderColor: 'var(--border-subtle)' }
                            }, [
                                // Connect
                                React.createElement('button', {
                                    className: 'p-1 hover:bg-gray-100 rounded-full text-clay-600 cursor-crosshair transition-colors',
                                    title: 'Drag to connect',
                                    onMouseDown: (e) => startConnection(e, node.id)
                                }, React.createElement('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                                    React.createElement('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }),
                                    React.createElement('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' })
                                )),
                                // Delete
                                React.createElement('button', {
                                    className: 'p-1 hover:bg-red-50 rounded-full text-red-500 transition-colors',
                                    onClick: (e) => deleteNode(e, node.id)
                                }, '×')
                            ]),

                            // Label (Name) floating below
                            React.createElement('div', {
                                className: 'absolute bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold px-2 py-1 rounded bg-white/90 backdrop-blur-sm border shadow-sm whitespace-nowrap pointer-events-none',
                                style: { color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }
                            }, node.label)
                        ]);
                    }

                    // Standard Node Rendering
                    return React.createElement('div', {
                        key: node.id,
                        className: 'absolute flex flex-col items-center gap-4 z-10',
                        style: {
                            left: node.x,
                            top: node.y,
                            width: '240px', // Reduced width
                            cursor: draggedNode === node.id ? 'grabbing' : 'grab',
                            userSelect: 'none',
                            pointerEvents: 'auto' // Re-enable pointer events for nodes
                        },
                        onMouseDown: (e) => handleMouseDown(e, node.id),
                        onMouseUp: (e) => completeConnection(e, node.id)
                    }, [
                        // Drop Zone Card
                        React.createElement('div', {
                            className: `relative w-full p-4 rounded-2xl border transition-all duration-300 group`,
                            style: {
                                backgroundColor: node.isStart ? 'var(--bg-secondary)' : 'var(--bg-elevated)',
                                borderColor: isActive ? 'var(--clay-600)' : (node.isStart ? 'transparent' : 'var(--border-subtle)'),
                                boxShadow: isActive ? '0 10px 20px -5px rgba(0,0,0,0.1)' : '0 2px 4px -1px rgba(0,0,0,0.05)',
                                minHeight: '120px'
                            }
                        }, [
                            // Header
                            React.createElement('div', { className: 'flex items-start justify-between mb-4' }, [
                                React.createElement('div', {}, [
                                    React.createElement('h3', { className: 'font-bold text-sm', style: { color: 'var(--text-primary)' } }, node.label),
                                    React.createElement('p', { className: 'text-xs', style: { color: 'var(--text-muted)' } }, node.desc)
                                ]),
                                // Actions
                                !node.isStart && React.createElement('div', { className: 'flex items-center gap-1' }, [
                                    // Edit Button
                                    React.createElement('button', {
                                        className: 'text-muted hover:text-clay-600 transition-colors p-1 rounded hover:bg-clay-50/10',
                                        title: 'Edit Node',
                                        onClick: (e) => {
                                            e.stopPropagation();
                                            setSelectedNodeId(node.id);
                                        }
                                    }, React.createElement('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                                        React.createElement('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
                                        React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
                                    )),
                                    // Connect Button
                                    React.createElement('button', {
                                        className: 'text-muted hover:text-clay-600 transition-colors p-1 rounded hover:bg-clay-50/10 cursor-crosshair',
                                        title: 'Drag to connect',
                                        onMouseDown: (e) => startConnection(e, node.id)
                                    }, React.createElement('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                                        React.createElement('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }),
                                        React.createElement('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' })
                                    )),
                                    // Delete Button
                                    React.createElement('button', {
                                        className: 'text-muted hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50/10',
                                        onClick: (e) => deleteNode(e, node.id)
                                    }, '×')
                                ])
                            ]),

                            // Content
                            node.isStart ? React.createElement('div', {
                                className: 'flex items-center justify-center h-12 mt-2'
                            }, [
                                React.createElement('div', {
                                    className: 'w-10 h-10 rounded-full flex items-center justify-center',
                                    style: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
                                }, '➜')
                            ]) : (node.model ? React.createElement('div', {
                                className: 'flex items-center gap-3 mt-2',
                            }, [
                                React.createElement('div', { className: 'relative flex-shrink-0' }, [
                                    React.createElement('div', {
                                        className: 'absolute inset-0 blur-md opacity-20 rounded-full',
                                        style: { background: 'var(--clay-600)' }
                                    }),
                                    React.createElement('img', {
                                        src: getModelLogo(node.model),
                                        className: 'relative w-12 h-12 object-contain',
                                    })
                                ]),
                                React.createElement('div', { className: 'flex-1 min-w-0' }, [
                                    React.createElement('span', {
                                        className: 'block text-sm font-bold truncate',
                                        style: { color: 'var(--text-primary)' }
                                    }, node.model),
                                    React.createElement('span', {
                                        className: 'block text-[10px] text-muted uppercase tracking-wider'
                                    }, 'Active')
                                ])
                            ]) : React.createElement('div', {
                                className: 'flex items-center justify-center h-12 border-2 border-dashed rounded-lg mt-2 gap-2',
                                style: { borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }
                            }, [
                                React.createElement('span', { className: 'text-xs font-medium' }, 'No Model Selected')
                            ]))
                        ])
                    ]);
                })
            ]),

            // Configuration Modal
            selectedNodeId && (() => {
                const node = nodes.find(n => n.id === selectedNodeId);
                if (!node) return null;

                return React.createElement('div', {
                    className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm',
                    onClick: () => setSelectedNodeId(null)
                }, [
                    React.createElement('div', {
                        className: 'w-[500px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col',
                        style: { backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' },
                        onClick: e => e.stopPropagation()
                    }, [
                        // Header
                        React.createElement('div', {
                            className: 'px-6 py-4 border-b flex items-center justify-between',
                            style: { borderColor: 'var(--border-subtle)' }
                        }, [
                            React.createElement('h3', { className: 'font-bold text-lg', style: { color: 'var(--text-primary)' } }, node.isCondition ? 'Configure Condition' : 'Configure Node'),
                            React.createElement('button', {
                                onClick: () => setSelectedNodeId(null),
                                className: 'text-muted hover:text-primary'
                            }, '×')
                        ]),
                        // Body
                        React.createElement('div', { className: 'p-6 flex flex-col gap-4' }, [
                            // Label Input
                            React.createElement('div', {}, [
                                React.createElement('label', { className: 'block text-xs font-bold uppercase mb-1 text-muted' }, node.isCondition ? 'Condition Name' : 'Node Name'),
                                React.createElement('input', {
                                    className: 'w-full px-3 py-2 rounded-lg border bg-transparent focus:ring-2 focus:ring-clay-500 outline-none',
                                    style: { borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' },
                                    value: node.label,
                                    onChange: e => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, label: e.target.value } : n))
                                })
                            ]),
                            // Condition Specific Inputs
                            node.isCondition ? React.createElement('div', {}, [
                                React.createElement('label', { className: 'block text-xs font-bold uppercase mb-1 text-muted' }, 'Condition (English)'),
                                React.createElement('textarea', {
                                    className: 'w-full px-3 py-2 rounded-lg border bg-transparent focus:ring-2 focus:ring-clay-500 outline-none h-24 resize-none',
                                    style: { borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' },
                                    value: node.condition || '',
                                    onChange: e => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, condition: e.target.value } : n)),
                                    placeholder: 'e.g. If the code fails validation...'
                                })
                            ]) : [
                                // Standard Node Inputs
                                // Description Input
                                React.createElement('div', { key: 'desc' }, [
                                    React.createElement('label', { className: 'block text-xs font-bold uppercase mb-1 text-muted' }, 'Description'),
                                    React.createElement('input', {
                                        className: 'w-full px-3 py-2 rounded-lg border bg-transparent focus:ring-2 focus:ring-clay-500 outline-none',
                                        style: { borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' },
                                        value: node.desc,
                                        onChange: e => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, desc: e.target.value } : n))
                                    })
                                ]),
                                // Model Selection
                                React.createElement('div', { key: 'model' }, [
                                    React.createElement('label', { className: 'block text-xs font-bold uppercase mb-1 text-muted' }, 'Model'),
                                    React.createElement('div', { className: 'grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1' },
                                        codeFlowModels.map(model =>
                                            React.createElement('button', {
                                                key: model.name,
                                                onClick: () => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, model: model.name } : n)),
                                                className: `p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${node.model === model.name ? 'ring-2 ring-clay-500 border-transparent bg-clay-50/10' : 'hover:border-clay-400'}`,
                                                style: { borderColor: node.model === model.name ? 'transparent' : 'var(--border-subtle)' }
                                            }, [
                                                React.createElement('img', { src: model.logo, className: 'w-8 h-8 object-contain' }),
                                                React.createElement('div', {}, [
                                                    React.createElement('div', { className: 'font-bold text-sm', style: { color: 'var(--text-primary)' } }, model.name),
                                                    React.createElement('div', { className: 'text-[10px] text-muted' }, 'AI Model')
                                                ])
                                            ])
                                        )
                                    )
                                ]),
                                // Prompt Input
                                React.createElement('div', { key: 'prompt' }, [
                                    React.createElement('label', { className: 'block text-xs font-bold uppercase mb-1 text-muted' }, 'System Prompt'),
                                    React.createElement('textarea', {
                                        className: 'w-full px-3 py-2 rounded-lg border bg-transparent focus:ring-2 focus:ring-clay-500 outline-none h-32 resize-none',
                                        style: { borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' },
                                        value: node.prompt,
                                        onChange: e => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, prompt: e.target.value } : n)),
                                        placeholder: 'Enter instructions for this step...'
                                    })
                                ])
                            ]
                        ]),
                        // Footer
                        React.createElement('div', {
                            className: 'px-6 py-4 border-t flex justify-end',
                            style: { borderColor: 'var(--border-subtle)' }
                        }, [
                            React.createElement('button', {
                                onClick: () => setSelectedNodeId(null),
                                className: 'px-6 py-2 rounded-xl font-bold text-white shadow-lg shadow-clay-500/20',
                                style: { background: 'var(--clay-600)' }
                            }, 'Done')
                        ])
                    ])
                ]);
            })()
        ])
    ]);
}

// Helper for curved edges
const getCurvedPath = (x1, y1, x2, y2) => {
    const dx = Math.abs(x2 - x1);
    const controlX = dx * 0.5; // Control point distance
    return `M ${x1} ${y1} C ${x1 + controlX} ${y1}, ${x2 - controlX} ${y2}, ${x2} ${y2}`;
};

function ProfileBuilderShell() {
    const [state, setState] = useState({ visible: false, options: {} });

    useEffect(() => {
        const unsubscribe = overlayController.subscribe(event => {
            if (event.type === 'open') {
                setState({ visible: true, options: event.options || {} });
            } else if (event.type === 'close') {
                setState({ visible: false, options: {} });
            }
        });
        return unsubscribe;
    }, []);

    return state.visible ? React.createElement(ProfileBuilder, {
        onDismiss: overlayController.close,
        initialOptions: state.options
    }) : null;
}

// Slider component
const WeightSlider = ({ label, value, onChange, showWeight = true }) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return React.createElement('div', {
        className: 'flex items-center justify-between gap-3'
    }, [
        React.createElement('span', {
            key: 'label',
            className: 'text-sm flex-1',
            style: { color: isDark ? '#c9a38a' : '#2b1d14' }
        }, label),
        React.createElement('input', {
            key: 'slider',
            type: 'range',
            min: '0',
            max: '1',
            step: '0.05',
            value: value,
            onChange: e => onChange(parseFloat(e.target.value)),
            className: 'w-24 h-1 appearance-none rounded-full bg-[rgba(92,49,30,0.15)]',
            style: { accentColor: '#b56747' }
        }),
        showWeight && React.createElement('span', {
            key: 'value',
            className: 'text-xs w-16 text-right',
            style: { color: isDark ? 'rgba(201, 163, 138, 0.8)' : 'rgba(43, 29, 20, 0.6)' }
        }, `Weight ${value.toFixed(2)}`)
    ]);
};

// Number input component
const NumberInput = ({ label, value, onChange, step = 1, placeholder = 'None' }) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return React.createElement('div', {
        className: 'flex items-center justify-between gap-3'
    }, [
        React.createElement('span', {
            key: 'label',
            className: 'text-sm flex-1',
            style: { color: isDark ? '#c9a38a' : '#2b1d14' }
        }, label),
        React.createElement('input', {
            key: 'input',
            type: 'number',
            value: value === null || value === undefined ? '' : value,
            step: step,
            placeholder: placeholder,
            onChange: e => {
                const raw = e.target.value;
                if (raw === '') {
                    onChange(null);
                    return;
                }
                const parsed = parseFloat(raw);
                onChange(Number.isNaN(parsed) ? null : parsed);
            },
            className: 'w-20 px-2 py-1 text-sm text-right rounded-lg border',
            style: {
                borderColor: isDark ? 'rgba(201, 163, 138, 0.35)' : 'rgba(92, 49, 30, 0.15)',
                color: isDark ? '#c9a38a' : '#2b1d14',
                backgroundColor: isDark ? 'var(--bg-elevated)' : 'white'
            }
        })
    ]);
};

// Toggle switch component
const Toggle = ({ label, icon, enabled, onChange }) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return React.createElement('div', {
        className: 'flex items-center justify-between gap-2'
    }, [
        React.createElement('div', {
            key: 'label',
            className: 'flex items-center gap-2'
        }, [
            icon && React.createElement('span', {
                key: 'icon',
                className: 'w-5 h-5 rounded text-xs flex items-center justify-center font-semibold',
                style: {
                    backgroundColor: isDark ? 'rgba(201, 163, 138, 0.15)' : 'rgba(92, 49, 30, 0.1)',
                    color: isDark ? '#c9a38a' : '#5b2a1a'
                }
            }, icon),
            React.createElement('span', {
                key: 'text',
                className: 'text-sm',
                style: { color: isDark ? '#c9a38a' : '#2b1d14' }
            }, label)
        ]),
        React.createElement('button', {
            key: 'toggle',
            type: 'button',
            onClick: () => onChange(!enabled),
            className: 'w-10 h-5 rounded-full transition-colors relative',
            style: {
                backgroundColor: enabled ?
                    (isDark ? '#f5b899' : '#b56747') :
                    (isDark ? 'rgba(201, 163, 138, 0.2)' : 'rgba(92, 49, 30, 0.15)')
            }
        }, React.createElement('span', {
            className: 'absolute top-0.5 w-4 h-4 rounded-full shadow transition-transform',
            style: {
                left: enabled ? '22px' : '2px',
                backgroundColor: isDark ? 'var(--bg-elevated)' : 'white'
            }
        }))
    ]);
};

// Rule card component (simplified - just shows name)
const RuleCard = ({ rule, onDelete }) => {
    return React.createElement('div', {
        className: 'rounded-xl border p-3 mb-2 flex items-center justify-between',
        style: { borderColor: 'rgba(92, 49, 30, 0.15)', backgroundColor: 'rgba(92, 49, 30, 0.02)' }
    }, [
        React.createElement('span', {
            key: 'name',
            className: 'text-sm font-medium',
            style: { color: '#2b1d14' }
        }, rule.name),
        React.createElement('button', {
            key: 'delete',
            type: 'button',
            onClick: onDelete,
            className: 'text-xs px-2 py-1 rounded transition hover:bg-[rgba(142,60,44,0.1)]',
            style: { color: '#8e3c2c' }
        }, '×')
    ]);
};

// Rule editor modal
const RuleEditorModal = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [condition, setCondition] = useState('tokenCount');
    const [operator, setOperator] = useState('>');
    const [value, setValue] = useState('');
    const [action, setAction] = useState('preferCheap');

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({ id: Date.now(), name, condition, operator, value, action });
        setName('');
        setCondition('tokenCount');
        setOperator('>');
        setValue('');
        setAction('preferCheap');
        onClose();
    };

    return React.createElement('div', {
        className: 'fixed inset-0 z-50 flex items-center justify-center',
        style: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        onClick: onClose
    }, React.createElement('div', {
        className: 'bg-white rounded-2xl p-6 w-96 shadow-2xl',
        style: { color: '#2b1d14' },
        onClick: e => e.stopPropagation()
    }, [
        React.createElement('h3', {
            key: 'title',
            className: 'text-lg font-semibold mb-4',
            style: { color: '#5b2a1a' }
        }, 'Create New Rule'),
        React.createElement('div', {
            key: 'name-field',
            className: 'mb-4'
        }, [
            React.createElement('label', {
                key: 'label',
                className: 'text-xs uppercase tracking-wider mb-2 block',
                style: { color: 'rgba(43, 29, 20, 0.5)' }
            }, 'Rule Name'),
            React.createElement('input', {
                key: 'input',
                type: 'text',
                value: name,
                onChange: e => setName(e.target.value),
                placeholder: 'e.g., Prefer cheap for long prompts',
                className: 'w-full px-3 py-2 rounded-lg border text-sm',
                style: { borderColor: 'rgba(92, 49, 30, 0.15)', color: '#2b1d14' }
            })
        ]),
        React.createElement('div', {
            key: 'condition-field',
            className: 'mb-4'
        }, [
            React.createElement('label', {
                key: 'label',
                className: 'text-xs uppercase tracking-wider mb-2 block',
                style: { color: 'rgba(43, 29, 20, 0.5)' }
            }, 'Condition'),
            React.createElement('div', {
                key: 'inputs',
                className: 'flex gap-2'
            }, [
                React.createElement('select', {
                    key: 'condition',
                    value: condition,
                    onChange: e => setCondition(e.target.value),
                    className: 'flex-1 text-sm px-2 py-2 rounded-lg border bg-white',
                    style: { borderColor: 'rgba(92, 49, 30, 0.15)', color: '#2b1d14' }
                }, ruleConditions.map(c => React.createElement('option', { key: c.id, value: c.id }, c.label))),
                React.createElement('select', {
                    key: 'operator',
                    value: operator,
                    onChange: e => setOperator(e.target.value),
                    className: 'w-16 text-sm px-2 py-2 rounded-lg border bg-white',
                    style: { borderColor: 'rgba(92, 49, 30, 0.15)', color: '#2b1d14' }
                }, [
                    React.createElement('option', { key: '>', value: '>' }, '>'),
                    React.createElement('option', { key: '<', value: '<' }, '<'),
                    React.createElement('option', { key: '=', value: '=' }, '='),
                ]),
                React.createElement('input', {
                    key: 'value',
                    type: 'text',
                    value: value,
                    onChange: e => setValue(e.target.value),
                    placeholder: condition === 'promptContains' ? 'text' : '300',
                    className: 'w-20 text-sm px-2 py-2 rounded-lg border bg-white',
                    style: { borderColor: 'rgba(92, 49, 30, 0.15)', color: '#2b1d14' }
                })
            ])
        ]),
        React.createElement('div', {
            key: 'action-field',
            className: 'mb-6'
        }, [
            React.createElement('label', {
                key: 'label',
                className: 'text-xs uppercase tracking-wider mb-2 block',
                style: { color: 'rgba(43, 29, 20, 0.5)' }
            }, 'Then'),
            React.createElement('select', {
                key: 'action',
                value: action,
                onChange: e => setAction(e.target.value),
                className: 'w-full text-sm px-3 py-2 rounded-lg border bg-white',
                style: { borderColor: 'rgba(92, 49, 30, 0.15)', color: '#2b1d14' }
            }, ruleActions.map(a => React.createElement('option', { key: a.id, value: a.id }, a.label)))
        ]),
        React.createElement('div', {
            key: 'buttons',
            className: 'flex gap-3'
        }, [
            React.createElement('button', {
                key: 'cancel',
                type: 'button',
                onClick: onClose,
                className: 'flex-1 py-2 rounded-lg border text-sm',
                style: { borderColor: 'rgba(92, 49, 30, 0.2)', color: 'rgba(43, 29, 20, 0.7)' }
            }, 'Cancel'),
            React.createElement('button', {
                key: 'save',
                type: 'button',
                onClick: handleSave,
                className: 'flex-1 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90',
                style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
            }, 'Create Rule')
        ])
    ]));
};

// Local Models info modal
const LocalModelsInfoModal = ({ isOpen, onClose, onEnable }) => {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const localModels = [
        // Llama Family
        { name: 'Llama 3.3 70B', desc: 'Latest Llama model with enhanced capabilities' },
        { name: 'Llama 3.2 1B', desc: 'Ultra-lightweight for mobile and edge devices' },
        { name: 'Llama 3.2 3B', desc: 'Compact model with strong performance' },
        { name: 'Llama 3.2 11B Vision', desc: 'Vision-enabled model for image understanding' },
        { name: 'Llama 3.2 90B Vision', desc: 'Large vision model for complex image reasoning' },
        { name: 'Llama 3.1 8B', desc: 'Efficient model for general tasks and coding' },
        { name: 'Llama 3.1 70B', desc: 'Powerful model for complex reasoning' },
        { name: 'Llama 3.1 405B', desc: 'Massive model for enterprise workloads' },

        // Mistral Family
        { name: 'Mistral 7B v0.3', desc: 'Fast 7B model with strong performance' },
        { name: 'Mistral Large 2', desc: 'Advanced reasoning with 128k context window' },
        { name: 'Mistral Small 3', desc: 'New benchmarks in sub-70B category' },
        { name: 'Codestral', desc: 'Specialized for code generation tasks' },
        { name: 'Mixtral 8x7B', desc: 'Mixture of experts for efficient scaling' },

        // Phi Family
        { name: 'Phi-4 14B', desc: 'Latest reasoning model from Microsoft' },
        { name: 'Phi-4 Mini', desc: 'Enhanced multilingual and function calling' },
        { name: 'Phi-3 3B Mini', desc: 'Lightweight state-of-the-art model' },
        { name: 'Phi-3 14B Medium', desc: 'Medium-sized model with strong capabilities' },

        // Gemma Family
        { name: 'Gemma 2 2B', desc: 'High-performing compact model' },
        { name: 'Gemma 2 9B', desc: 'Efficient mid-size model' },
        { name: 'Gemma 2 27B', desc: 'Large model with strong performance' },
        { name: 'CodeGemma', desc: 'Code completion and generation specialist' },

        // DeepSeek Family
        { name: 'DeepSeek-R1 671B', desc: 'Advanced reasoning model' },
        { name: 'DeepSeek-V3.1', desc: 'Hybrid thinking and non-thinking modes' },
        { name: 'DeepSeek Coder', desc: 'Trained on 2 trillion code tokens' },

        // Qwen Family
        { name: 'Qwen 3 4B', desc: 'Small efficient model from latest generation' },
        { name: 'Qwen 3 235B', desc: 'Massive model with exceptional capabilities' },
        { name: 'Qwen 2.5 7B', desc: 'Trained on 18 trillion tokens, 128k context' },
        { name: 'Qwen 2.5 14B', desc: 'Mid-size with multilingual support' },
        { name: 'Qwen 2.5 72B', desc: 'Large model with strong performance' },
        { name: 'QwQ', desc: 'Reasoning-focused model from Qwen series' },

        // Code Specialists
        { name: 'CodeLlama 7B', desc: 'Everyday coding help for 20+ languages' },
        { name: 'CodeLlama 13B', desc: 'Balanced code generation model' },
        { name: 'CodeLlama 34B', desc: 'Complex debugging and code generation' },

        // Other Notable Models
        { name: 'Dolphin 2.9 8B', desc: 'Uncensored Llama 3 based model' },
        { name: 'Dolphin 2.9 70B', desc: 'Large uncensored model' },
        { name: 'TinyLlama 1.1B', desc: 'Compact model trained on 3T tokens' },
        { name: 'Vicuna 7B', desc: 'Open-source chatbot trained by fine-tuning LLaMA' },
        { name: 'Orca 2', desc: 'Microsoft research model with strong reasoning' },
        { name: 'Nous Hermes 2', desc: 'General purpose instruct model' },
        { name: 'Solar 10.7B', desc: 'Depth upscaled Llama-based model' },
    ];

    const filteredModels = localModels.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.desc.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return React.createElement('div', {
        className: 'fixed inset-0 z-50 flex items-center justify-center',
        style: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
        onClick: onClose
    }, React.createElement('div', {
        className: 'bg-white rounded-2xl p-6 w-[1000px] shadow-2xl max-h-[80vh] overflow-hidden flex flex-col',
        style: { color: '#2b1d14' },
        onClick: e => e.stopPropagation()
    }, [
        React.createElement('h3', {
            key: 'title',
            className: 'text-xl font-semibold mb-2',
            style: { color: '#5b2a1a' }
        }, 'Use Your Own Local Models'),
        React.createElement('p', {
            key: 'desc',
            className: 'text-sm mb-4',
            style: { color: 'rgba(43, 29, 20, 0.65)' }
        }, 'Connect your locally-hosted models to Restruct. These models run on your hardware, giving you full control over latency, privacy, and cost.'),
        React.createElement('div', {
            key: 'search',
            className: 'mb-3'
        }, [
            React.createElement('label', {
                key: 'label',
                className: 'text-xs uppercase tracking-wider mb-2 block',
                style: { color: 'rgba(43, 29, 20, 0.5)' }
            }, 'Supported Models'),
            React.createElement('input', {
                key: 'input',
                type: 'text',
                value: searchQuery,
                onChange: e => setSearchQuery(e.target.value),
                placeholder: 'Search models...',
                className: 'w-full px-3 py-2 rounded-lg border text-sm',
                style: { borderColor: 'rgba(92, 49, 30, 0.15)', color: '#2b1d14' }
            })
        ]),
        React.createElement('div', {
            key: 'model-list',
            className: 'flex-1 overflow-y-auto mb-4 space-y-2',
            style: { maxHeight: '240px' }
        }, filteredModels.map(model => React.createElement('div', {
            key: model.name,
            className: 'p-3 rounded-lg border',
            style: { borderColor: 'rgba(92, 49, 30, 0.12)', backgroundColor: 'rgba(92, 49, 30, 0.02)' }
        }, [
            React.createElement('div', {
                key: 'name',
                className: 'text-sm font-semibold mb-1',
                style: { color: '#2b1d14' }
            }, model.name),
            React.createElement('div', {
                key: 'desc',
                className: 'text-xs',
                style: { color: 'rgba(43, 29, 20, 0.6)' }
            }, model.desc)
        ]))),
        React.createElement('div', {
            key: 'buttons',
            className: 'flex gap-3'
        }, [
            React.createElement('button', {
                key: 'cancel',
                type: 'button',
                onClick: onClose,
                className: 'flex-1 py-2 rounded-lg border text-sm',
                style: { borderColor: 'rgba(92, 49, 30, 0.2)', color: 'rgba(43, 29, 20, 0.7)' }
            }, 'Cancel'),
            React.createElement('button', {
                key: 'setup',
                type: 'button',
                onClick: () => window.open('local-models-setup.html', '_blank'),
                className: 'flex-1 py-2 rounded-lg border text-sm font-semibold transition hover:opacity-90',
                style: { borderColor: '#8e3c2c', color: '#8e3c2c' }
            }, 'Setup Instructions'),
            React.createElement('button', {
                key: 'enable',
                type: 'button',
                onClick: onEnable,
                className: 'flex-1 py-2 rounded-lg text-sm font-semibold transition hover:opacity-90',
                style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
            }, 'Enable Local Models')
        ])
    ]));
};

// Mini node card for graph
const MiniNodeCard = ({ title, subtitle, accent, active, onClick, nodeRef, hasToggle, enabled, onToggle, isLocal, large }) => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const borderColor = isDark ? 'rgba(201, 163, 138, 0.35)' : 'rgba(92, 49, 30, 0.12)';
    const activeBorderColor = isDark ? 'rgba(201, 163, 138, 0.5)' : '#8e3c2c';
    const titleColor = isLocal ? '#fffcf8' : (isDark ? '#c9a38a' : '#2b1d14');
    const subtitleColor = isLocal ? 'rgba(255, 252, 248, 0.8)' : (isDark ? 'rgba(201, 163, 138, 0.8)' : 'rgba(43, 29, 20, 0.6)');

    return React.createElement('div', {
        ref: nodeRef,
        className: `relative rounded-xl border-2 transition-all cursor-pointer ${active ? 'shadow-lg' : ''} ${large ? 'px-5 py-3' : 'px-3 py-2'}`,
        style: {
            backgroundColor: isLocal ? '#8e3c2c' : 'var(--bg-elevated)',
            minWidth: large ? '180px' : '120px',
            borderColor: active ? activeBorderColor : (isLocal ? activeBorderColor : borderColor)
        },
        onClick
    }, [
        React.createElement('div', {
            key: 'bg',
            className: 'pointer-events-none absolute inset-0 rounded-xl',
            style: { background: isLocal ? 'radial-gradient(circle at top, rgba(0, 0, 0, 0.1), transparent)' : `radial-gradient(circle at top, ${accent}40, transparent)`, opacity: isLocal ? 1 : 0.15 }
        }),
        React.createElement('div', {
            key: 'content',
            className: 'relative flex items-center justify-between gap-2'
        }, [
            React.createElement('div', { key: 'text' }, [
                React.createElement('p', {
                    key: 'title',
                    className: large ? 'text-base font-semibold' : 'text-sm font-semibold',
                    style: { color: titleColor }
                }, title),
                subtitle && React.createElement('p', {
                    key: 'subtitle',
                    className: 'text-xs',
                    style: { color: subtitleColor }
                }, subtitle)
            ]),
            hasToggle && React.createElement('button', {
                key: 'toggle',
                type: 'button',
                onClick: e => { e.stopPropagation(); onToggle(!enabled); },
                className: 'w-8 h-4 rounded-full transition-colors relative',
                style: { backgroundColor: isLocal ? (enabled ? 'rgba(255, 252, 248, 0.9)' : 'rgba(255, 252, 248, 0.2)') : (enabled ? '#b56747' : 'rgba(92, 49, 30, 0.15)') }
            }, React.createElement('span', {
                className: 'absolute top-0.5 w-3 h-3 rounded-full shadow transition-transform',
                style: { left: enabled ? '17px' : '2px', backgroundColor: isLocal ? (enabled ? '#8e3c2c' : 'var(--bg-elevated)') : 'var(--bg-elevated)' }
            }))
        ])
    ]);
};

// Toast notification component
const Toast = ({ message, type, onClose }) => {
    const toastRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'success'
        ? 'linear-gradient(135deg, rgba(92, 49, 30, 0.97), rgba(94, 52, 42, 0.97))'
        : type === 'error'
            ? 'linear-gradient(135deg, rgba(139, 79, 63, 0.97), rgba(94, 52, 42, 0.97))'
            : 'linear-gradient(135deg, rgba(92, 49, 30, 0.95), rgba(139, 79, 63, 0.95))';

    return React.createElement('div', {
        ref: toastRef,
        className: 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto',
        style: { animation: 'toastSlideUp 0.3s ease-out' }
    }, React.createElement('div', {
        className: 'px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3',
        style: {
            background: bgColor,
            color: '#fffdf9',
            minWidth: '200px',
            backdropFilter: 'blur(8px)'
        }
    }, [
        // Icon
        React.createElement('span', {
            key: 'icon',
            className: 'text-lg'
        }, type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'),
        // Message
        React.createElement('span', {
            key: 'message',
            className: 'text-sm font-medium'
        }, message)
    ]));
};

// Inject toast animation styles
const toastStyles = `
@keyframes toastSlideUp {
    from { transform: translateX(-50%) translateY(20px); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
}
`;

// Weight bar chart for summary
const WeightBarChart = ({ weights }) => {
    const maxWeight = Math.max(...weights.map(w => w.weight));
    const labels = ['Q', 'C', 'L'];

    return React.createElement('div', {
        className: 'flex items-end gap-1 h-16'
    }, weights.map((w, i) => React.createElement('div', {
        key: w.id,
        className: 'flex flex-col items-center gap-1'
    }, [
        React.createElement('div', {
            key: 'bar',
            className: 'w-4 rounded-t',
            style: {
                height: `${(w.weight / maxWeight) * 48}px`,
                backgroundColor: '#c98454',
                minHeight: '4px'
            }
        }),
        React.createElement('span', {
            key: 'label',
            className: 'text-xs',
            style: { color: 'rgba(43, 29, 20, 0.5)' }
        }, labels[i] || w.label[0])
    ])));
};

// Mesh background
const MeshLensBackground = () => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const rafRef = useRef(null);
    const pointsRef = useRef([]);
    const originalPointsRef = useRef([]);
    const mouseRef = useRef({ x: -1000, y: -1000, isActive: false });
    const gridDimensionsRef = useRef({ cols: 0, rows: 0 });

    const config = useMemo(() => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            gridSize: 35,
            gravityStrength: 18,
            influenceRadius: 100,
            dampening: 0.95,
            returnSpeed: 0.05,
            lineColor: isDark ? 'rgba(201, 163, 138, 0.35)' : 'rgba(92, 49, 30, 0.15)',
            maxDisplacement: 20
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');

        const resizeCanvas = () => {
            const rect = container.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            canvas.width = rect.width;
            canvas.height = rect.height;
            initializeGrid();
        };

        const initializeGrid = () => {
            pointsRef.current = [];
            originalPointsRef.current = [];
            const cols = Math.ceil(canvas.width / config.gridSize) + 1;
            const rows = Math.ceil(canvas.height / config.gridSize) + 1;
            gridDimensionsRef.current = { cols, rows };

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const x = i * config.gridSize;
                    const y = j * config.gridSize;
                    pointsRef.current.push({ x, y, vx: 0, vy: 0, originalX: x, originalY: y });
                    originalPointsRef.current.push({ x, y });
                }
            }
        };

        const updatePoints = () => {
            pointsRef.current.forEach((point, index) => {
                const original = originalPointsRef.current[index];
                const dx = mouseRef.current.x - point.x;
                const dy = mouseRef.current.y - point.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (mouseRef.current.isActive && distance < config.influenceRadius) {
                    const force = (1 - distance / config.influenceRadius) * config.gravityStrength;
                    const angle = Math.atan2(dy, dx);
                    point.vx += Math.cos(angle) * force * 0.01;
                    point.vy += Math.sin(angle) * force * 0.01;
                } else {
                    point.vx += (original.x - point.x) * config.returnSpeed;
                    point.vy += (original.y - point.y) * config.returnSpeed;
                }

                point.vx *= config.dampening;
                point.vy *= config.dampening;
                point.x += point.vx;
                point.y += point.vy;

                const dispX = point.x - original.x;
                const dispY = point.y - original.y;
                const displacement = Math.sqrt(dispX * dispX + dispY * dispY);

                if (displacement > config.maxDisplacement) {
                    const scale = config.maxDisplacement / displacement;
                    point.x = original.x + dispX * scale;
                    point.y = original.y + dispY * scale;
                }
            });
        };

        const drawMesh = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const { cols, rows } = gridDimensionsRef.current;
            if (!cols || !rows || pointsRef.current.length === 0) return;

            ctx.strokeStyle = config.lineColor;
            ctx.lineWidth = 1;

            for (let j = 0; j < rows; j++) {
                ctx.beginPath();
                for (let i = 0; i < cols; i++) {
                    const index = i * rows + j;
                    const point = pointsRef.current[index];
                    if (!point) continue;
                    if (i === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                }
                ctx.stroke();
            }

            for (let i = 0; i < cols; i++) {
                ctx.beginPath();
                for (let j = 0; j < rows; j++) {
                    const index = i * rows + j;
                    const point = pointsRef.current[index];
                    if (!point) continue;
                    if (j === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                }
                ctx.stroke();
            }
        };

        const animate = () => {
            try {
                updatePoints();
                drawMesh();
                rafRef.current = requestAnimationFrame(animate);
            } catch (e) {
                console.error("Mesh animation error:", e);
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
            }
        };

        const handleMouseMove = (e) => {
            const rect = container.getBoundingClientRect();
            mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, isActive: true };
        };

        const handleMouseLeave = () => {
            mouseRef.current.isActive = false;
        };

        const parentElement = container.parentElement;
        const initTimeout = setTimeout(() => {
            resizeCanvas();
            rafRef.current = requestAnimationFrame(animate);
        }, 50);

        window.addEventListener('resize', resizeCanvas);

        // Only attach if parentElement exists and is valid
        if (parentElement && parentElement.addEventListener) {
            try {
                parentElement.addEventListener('mousemove', handleMouseMove);
                parentElement.addEventListener('mouseleave', handleMouseLeave);
            } catch (e) {
                console.warn("Could not attach mesh listeners to parent");
            }
        }

        return () => {
            clearTimeout(initTimeout);
            window.removeEventListener('resize', resizeCanvas);
            if (parentElement) {
                parentElement.removeEventListener('mousemove', handleMouseMove);
                parentElement.removeEventListener('mouseleave', handleMouseLeave);
            }
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [config]);

    // Safety check: if refs are not ready, return null to avoid crash
    // But we can't check refs in render easily as they are populated after render.
    // The useEffect handles the null check.

    return React.createElement('div', {
        ref: containerRef,
        className: 'absolute inset-0 overflow-hidden pointer-events-none',
        style: { zIndex: 0 }
    }, React.createElement('canvas', { ref: canvasRef, className: 'absolute inset-0 w-full h-full' }));
};

function ProfileBuilder({ onDismiss, initialOptions }) {
    if (initialOptions?.mode === 'codeflow') {
        // Wrap in a simple error boundary logic or just return
        try {
            return React.createElement(CodeFlowBuilder, { onDismiss, initialOptions });
        } catch (e) {
            console.error("CodeFlowBuilder render error:", e);
            return React.createElement('div', { className: 'p-8 text-white' }, "Error loading Code Flow Designer");
        }
    }

    const [leftPanelMode, setLeftPanelMode] = useState('settings'); // 'settings' or 'rules'
    const [profileName, setProfileName] = useState('');
    const [description, setDescription] = useState('');
    const [weights, setWeights] = useState(defaultWeights);
    const [hardLimits, setHardLimits] = useState(defaultHardLimits);
    const [providers, setProviders] = useState(
        providerPresets.map(p => ({
            ...p,
            enabled: p.id === 'local' ? false : true,
            enabledModels: p.models.reduce((acc, model) => ({ ...acc, [model]: true }), {})
        }))
    );
    const [expandedProviders, setExpandedProviders] = useState({});
    const [rules, setRules] = useState([]);
    const [systemPrompt, setSystemPrompt] = useState('');
    const [systemPromptModalOpen, setSystemPromptModalOpen] = useState(false);
    const [systemPromptDraft, setSystemPromptDraft] = useState('');
    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [localModelsModalOpen, setLocalModelsModalOpen] = useState(false);
    const [hasSeenLocalModelsInfo, setHasSeenLocalModelsInfo] = useState(false);
    const [testPrompt, setTestPrompt] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [isTestingRoute, setIsTestingRoute] = useState(false);
    const [animatingEdges, setAnimatingEdges] = useState(false);
    const [modelsModalOpen, setModelsModalOpen] = useState(false);
    const [modelSearchQuery, setModelSearchQuery] = useState('');
    const [activePopup, setActivePopup] = useState(null); // { type: 'userPrompt' | 'specialRules' | 'weight' | 'router', data: {...}, position: {x, y}, fullscreen: false }
    const [testPromptDraft, setTestPromptDraft] = useState('');

    const containerRef = useRef(null);
    const userPromptRef = useRef(null);
    const specialRulesRef = useRef(null);
    const leftRefs = useRef({});
    const centerRef = useRef(null);
    const modelsNodeRef = useRef(null);
    const [nodePositions, setNodePositions] = useState({});

    const normalizeHardLimits = (limits = {}) => {
        return {
            maxCostPerCall: limits.maxCostPerCall ?? limits.max_cost_per_call ?? null,
            maxOutputTokens: limits.maxOutputTokens ?? limits.max_output_tokens ?? null,
            dailySpendLimit: limits.dailySpendLimit ?? limits.daily_spend_limit ?? null,
            dailyOutputTokens: limits.dailyOutputTokens ?? limits.daily_output_tokens ?? null
        };
    };

    const hydrateWeights = (graphState) => {
        if (Array.isArray(graphState?.weights)) return graphState.weights;
        if (Array.isArray(graphState?.priorities)) {
            return graphState.priorities.map(priority => ({
                id: priority.id,
                label: defaultWeights.find(w => w.id === priority.id)?.label || priority.id,
                weight: priority.weight
            }));
        }
        return defaultWeights;
    };

    useEffect(() => {
        const incoming = initialOptions?.profile;
        if (!incoming) return;

        setProfileName(incoming.name || '');
        setDescription(incoming.description || '');

        const graphState = incoming.graph_state || {};
        setWeights(hydrateWeights(graphState));
        setHardLimits({
            ...defaultHardLimits,
            ...normalizeHardLimits(graphState.hardLimits || graphState.hard_limits || graphState.hardLimits)
        });

        if (Array.isArray(graphState.providers)) {
            const mergedProviders = providerPresets.map(preset => {
                const override = graphState.providers.find(p => p.id === preset.id);
                if (override) {
                    // If no enabledModels in saved data, create from enabled status
                    const enabledModels = override.enabledModels ||
                        preset.models.reduce((acc, model) => ({ ...acc, [model]: override.enabled ?? true }), {});
                    return { ...preset, ...override, enabledModels };
                }
                return {
                    ...preset,
                    enabled: preset.id === 'local' ? false : true,
                    enabledModels: preset.models.reduce((acc, model) => ({ ...acc, [model]: preset.id !== 'local' }), {})
                };
            });
            setProviders(mergedProviders);
        }

        if (Array.isArray(graphState.rules)) {
            setRules(graphState.rules);
        }

        if (graphState.systemPrompt) {
            setSystemPrompt(graphState.systemPrompt);
        }
    }, [initialOptions]);

    // Inject cursor and toast styles
    useEffect(() => {
        const styleId = 'routing-lab-cursor-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = cursorStyles + toastStyles;
            document.head.appendChild(style);
        }
        return () => {
            const style = document.getElementById(styleId);
            if (style) style.remove();
        };
    }, []);

    const updateWeight = (id, newWeight) => {
        setWeights(prev => prev.map(w => w.id === id ? { ...w, weight: newWeight } : w));
    };

    const updateHardLimit = (key, value) => {
        setHardLimits(prev => ({ ...prev, [key]: value }));
    };

    const toggleProvider = (id) => {
        // If toggling Local Models ON for the first time, show info modal
        if (id === 'local') {
            const localProvider = providers.find(p => p.id === 'local');
            if (!localProvider.enabled && !hasSeenLocalModelsInfo) {
                setLocalModelsModalOpen(true);
                return;
            }
        }
        setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
    };

    const handleEnableLocalModels = () => {
        setProviders(prev => prev.map(p => p.id === 'local' ? { ...p, enabled: true } : p));
        setHasSeenLocalModelsInfo(true);
        setLocalModelsModalOpen(false);
        showToast('Local Models enabled', 'success');
    };

    const addRule = (newRule) => {
        setRules(prev => [...prev, newRule]);
    };

    const deleteRule = (id) => {
        setRules(prev => prev.filter(r => r.id !== id));
    };

    const openSystemPromptModal = () => {
        setSystemPromptDraft(systemPrompt || '');
        setSystemPromptModalOpen(true);
    };

    const saveSystemPrompt = () => {
        if (!systemPromptDraft.trim()) {
            showToast('System prompt cannot be empty', 'warning');
            return;
        }
        setSystemPrompt(systemPromptDraft.trim());
        setSystemPromptModalOpen(false);
        showToast('System prompt saved', 'success');
    };

    const showToast = (message, type) => {
        setToast({ message, type });
    };

    const openNodePopup = (type, nodeRef, data = {}) => {
        if (!nodeRef?.current || !containerRef.current) return;

        const nodeRect = nodeRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        // Position popup to the right of the node
        const position = {
            x: nodeRect.right - containerRect.left + 20,
            y: nodeRect.top - containerRect.top
        };

        setActivePopup({ type, data, position, fullscreen: false });
    };

    const closePopup = () => {
        setActivePopup(null);
    };

    const toggleFullscreen = () => {
        if (activePopup) {
            setActivePopup({ ...activePopup, fullscreen: !activePopup.fullscreen });
        }
    };

    const handleTestRoute = async () => {
        if (!testPrompt.trim()) {
            showToast('Please enter a test prompt', 'warning');
            return;
        }

        setIsTestingRoute(true);
        setAnimatingEdges(true);

        const graphState = { weights, hardLimits, providers, rules, systemPrompt };

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${window.API_URL}/profiles/test-route`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({
                    prompt: testPrompt,
                    graph_state: graphState
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to test route');
            }

            const result = await response.json();
            setTestResult(result);

            setTimeout(() => {
                setAnimatingEdges(false);
                showToast(`Selected: ${result.selected_model.display_name}`, 'success');
            }, 2000);

        } catch (error) {
            console.error('Test route error:', error);
            showToast(error.message || 'Failed to test route', 'error');
            setAnimatingEdges(false);
        } finally {
            setIsTestingRoute(false);
        }
    };

    const handleSave = async () => {
        if (!profileName.trim()) {
            showToast('Please enter a profile name', 'warning');
            return;
        }
        setIsSaving(true);

        const graphState = { weights, hardLimits, providers, rules, systemPrompt };
        const payload = { name: profileName, description, graph_state: graphState };
        const isEditing = Boolean(initialOptions?.profile?.slug);
        const targetSlug = initialOptions?.profile?.slug;
        const endpoint = isEditing && targetSlug
            ? `${window.API_URL}/profiles/${encodeURIComponent(targetSlug)}`
            : `${window.API_URL}/profiles`;
        const method = isEditing && targetSlug ? 'PATCH' : 'POST';

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to save profile');
            }
            const saved = await response.json();
            showToast('Profile saved successfully!', 'success');
            const savedProfile = saved.profile || {
                ...initialOptions?.profile,
                slug: targetSlug,
                name: profileName,
                description,
                graph_state: graphState
            };
            const eventName = isEditing ? 'routing-profile:updated' : 'routing-profile:created';
            window.dispatchEvent(new CustomEvent(eventName, { detail: { profile: savedProfile } }));
            setTimeout(() => onDismiss(), 500);
        } catch (err) {
            showToast(err.message || 'Failed to save profile', 'error');
        }
        setIsSaving(false);
    };

    useEffect(() => {
        const handleKey = event => {
            if (event.key === 'Escape') onDismiss();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onDismiss]);

    // Inject routing animation CSS
    useEffect(() => {
        const styleId = 'routing-animation-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            @keyframes routeFlow {
                0% { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: -24; }
            }
        `;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById(styleId);
            if (el) document.head.removeChild(el);
        };
    }, []);

    // Calculate node positions for graph edges
    useEffect(() => {
        const calculatePositions = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const positions = {};

            // User Prompt node
            if (userPromptRef.current) {
                const rect = userPromptRef.current.getBoundingClientRect();
                positions.userPrompt = {
                    x: rect.right - containerRect.left,
                    y: rect.top + rect.height / 2 - containerRect.top
                };
            }

            // Special Rules node
            if (specialRulesRef.current) {
                const rect = specialRulesRef.current.getBoundingClientRect();
                positions.specialRules = {
                    x: rect.right - containerRect.left,
                    y: rect.top + rect.height / 2 - containerRect.top,
                    left: rect.left - containerRect.left
                };
            }

            // Weight nodes
            weights.forEach(node => {
                const el = leftRefs.current[node.id];
                if (el) {
                    const rect = el.getBoundingClientRect();
                    positions[node.id] = {
                        x: rect.right - containerRect.left,
                        y: rect.top + rect.height / 2 - containerRect.top,
                        left: rect.left - containerRect.left
                    };
                }
            });

            // Router node
            if (centerRef.current) {
                const rect = centerRef.current.getBoundingClientRect();
                positions.router = {
                    left: rect.left - containerRect.left,
                    right: rect.right - containerRect.left,
                    y: rect.top + rect.height / 2 - containerRect.top
                };
            }

            // Models node
            if (modelsNodeRef.current) {
                const rect = modelsNodeRef.current.getBoundingClientRect();
                positions.models = {
                    x: rect.left - containerRect.left,
                    y: rect.top + rect.height / 2 - containerRect.top
                };
            }

            setNodePositions(positions);
        };

        // Run after layout settles
        const runCalculation = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(calculatePositions);
            });
        };

        runCalculation();
        window.addEventListener('resize', runCalculation);
        const timer1 = setTimeout(runCalculation, 50);
        const timer2 = setTimeout(runCalculation, 200);
        return () => {
            window.removeEventListener('resize', runCalculation);
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [weights, providers]);

    const activeProviders = providers.filter(p => p.enabled);

    return React.createElement('div', {
        className: 'relative h-full w-full flex flex-col',
        style: { backgroundColor: 'var(--bg-elevated)', cursor: defaultCursor },
        onClick: onDismiss
    }, [
        // Header with tabs
        React.createElement('div', {
            key: 'header',
            className: 'px-6 py-4 flex items-center justify-between border-b',
            style: { borderColor: 'rgba(92, 49, 30, 0.12)', backgroundColor: 'var(--bg-elevated)' },
            onClick: e => e.stopPropagation()
        }, [
            React.createElement('h1', {
                key: 'title',
                className: 'text-xl font-semibold flex items-center gap-2',
                style: { color: 'var(--text-primary)' }
            }, [
                React.createElement('img', {
                    key: 'icon',
                    src: 'assets/routing-controls-icon.png',
                    alt: 'Routing Lab',
                    className: 'w-6 h-6'
                }),
                'Routing Lab'
            ]),
            React.createElement('div', {
                key: 'right',
                className: 'flex items-center gap-3'
            }, [
                React.createElement('button', {
                    key: 'cancel',
                    type: 'button',
                    onClick: onDismiss,
                    className: 'px-4 py-2 text-sm rounded-lg border transition hover:bg-[rgba(92,49,30,0.04)]',
                    style: { borderColor: 'rgba(92, 49, 30, 0.2)', color: 'rgba(43, 29, 20, 0.7)' }
                }, 'Cancel'),
                React.createElement('button', {
                    key: 'save',
                    type: 'button',
                    onClick: handleSave,
                    disabled: isSaving,
                    className: 'px-5 py-2 text-sm font-semibold rounded-lg shadow-lg transition hover:opacity-90 disabled:opacity-60',
                    style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
                }, isSaving ? 'Saving...' : 'Save Profile')
            ])
        ]),

        // Main content
        React.createElement('div', {
            key: 'main',
            className: 'flex-1 flex overflow-hidden',
            onClick: e => e.stopPropagation()
        }, [
            // Left panel - Settings or Rules Engine
            React.createElement('div', {
                key: 'left-panel',
                className: 'w-72 border-r p-5 flex-shrink-0 overflow-hidden',
                style: { borderColor: 'rgba(92, 49, 30, 0.12)', backgroundColor: 'rgba(92, 49, 30, 0.02)' }
            }, [
                // Toggle between Settings and Rules
                React.createElement('div', {
                    key: 'panel-toggle',
                    className: 'flex items-center gap-1 p-1 rounded-xl mb-5',
                    style: { backgroundColor: 'rgba(92, 49, 30, 0.08)' }
                }, [
                    React.createElement('button', {
                        key: 'settings',
                        type: 'button',
                        onClick: () => setLeftPanelMode('settings'),
                        className: `flex-1 px-3 py-2 text-sm font-medium rounded-lg transition ${leftPanelMode === 'settings' ? 'bg-white shadow-sm' : ''}`,
                        style: { color: leftPanelMode === 'settings' ? 'var(--text-primary)' : 'rgba(43, 29, 20, 0.6)' }
                    }, 'Settings'),
                    React.createElement('button', {
                        key: 'rules',
                        type: 'button',
                        onClick: () => setLeftPanelMode('rules'),
                        className: `flex-1 px-3 py-2 text-sm font-medium rounded-lg transition ${leftPanelMode === 'rules' ? 'bg-white shadow-sm' : ''}`,
                        style: { color: leftPanelMode === 'rules' ? 'var(--text-primary)' : 'rgba(43, 29, 20, 0.6)' }
                    }, 'Rules')
                ]),

                // Settings content
                leftPanelMode === 'settings' && [
                    React.createElement('h3', {
                        key: 'settings-title',
                        className: 'text-xs font-semibold uppercase tracking-wider mb-4',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Weights'),
                    React.createElement('div', {
                        key: 'weights',
                        className: 'space-y-3 mb-6'
                    }, weights.map(w => React.createElement(WeightSlider, {
                        key: w.id,
                        label: w.label,
                        value: w.weight,
                        onChange: val => updateWeight(w.id, val)
                    }))),

                    React.createElement('h3', {
                        key: 'limits-title',
                        className: 'text-xs font-semibold uppercase tracking-wider mb-4 mt-6',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Hard Limits'),
                    React.createElement('div', {
                        key: 'limits',
                        className: 'space-y-3 mb-6'
                    }, [
                        React.createElement(NumberInput, { key: 'maxCost', label: 'Max cost per call ($)', value: hardLimits.maxCostPerCall, onChange: v => updateHardLimit('maxCostPerCall', v), step: 0.01 }),
                        React.createElement(NumberInput, { key: 'maxTokens', label: 'Max output tokens per call', value: hardLimits.maxOutputTokens, onChange: v => updateHardLimit('maxOutputTokens', v) }),
                        React.createElement(NumberInput, { key: 'dailySpend', label: 'Daily spend limit ($)', value: hardLimits.dailySpendLimit, onChange: v => updateHardLimit('dailySpendLimit', v), step: 0.01 }),
                        React.createElement(NumberInput, { key: 'dailyTokens', label: 'Daily output tokens', value: hardLimits.dailyOutputTokens, onChange: v => updateHardLimit('dailyOutputTokens', v) }),
                    ]),

                    React.createElement('h3', {
                        key: 'toggles-title',
                        className: 'text-xs font-semibold uppercase tracking-wider mb-4 mt-6',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Providers'),
                    React.createElement('div', {
                        key: 'toggles',
                        className: 'space-y-3'
                    }, providers.map(p => React.createElement(Toggle, {
                        key: p.id,
                        label: p.label,
                        icon: p.icon,
                        enabled: p.enabled,
                        onChange: () => toggleProvider(p.id)
                    })))
                ],

                // Rules content
                leftPanelMode === 'rules' && [
                    React.createElement('h3', {
                        key: 'title',
                        className: 'text-xs font-semibold uppercase tracking-wider mb-4',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Rules Engine'),
                    React.createElement('div', {
                        key: 'rules',
                        className: 'mb-4'
                    }, rules.length > 0 ? rules.map(rule => React.createElement(RuleCard, {
                        key: rule.id,
                        rule: rule,
                        onDelete: () => deleteRule(rule.id)
                    })) : React.createElement('p', {
                        className: 'text-sm text-center py-4',
                        style: { color: 'rgba(43, 29, 20, 0.4)' }
                    }, 'No rules yet')),
                    React.createElement('button', {
                        key: 'add',
                        type: 'button',
                        onClick: () => setRuleModalOpen(true),
                        className: 'w-full py-3 rounded-xl text-sm font-semibold transition hover:opacity-90',
                        style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
                    }, 'Add Rule'),
                    React.createElement('div', {
                        key: 'roles-section',
                        className: 'mt-6 p-4 rounded-xl',
                        style: { background: 'rgba(142, 60, 44, 0.05)', border: '1px dashed rgba(142, 60, 44, 0.2)' }
                    }, [
                        React.createElement('div', {
                            key: 'roles-header',
                            className: 'flex flex-col items-center gap-2 mb-3'
                        }, [
                            React.createElement('div', { key: 'titles', style: { textAlign: 'center' } }, [
                                React.createElement('div', {
                                    key: 'label',
                                    className: 'text-xs font-semibold uppercase tracking-wider',
                                    style: { color: 'rgba(43, 29, 20, 0.6)' }
                                }, 'System Prompt'),
                                React.createElement('div', {
                                    key: 'desc',
                                    className: 'text-xs',
                                    style: { color: 'rgba(43, 29, 20, 0.55)' }
                                }, 'Define a system prompt for all models.')
                            ]),
                            React.createElement('button', {
                                key: 'add-role',
                                type: 'button',
                                onClick: openSystemPromptModal,
                                className: 'py-3 px-6 rounded-xl text-sm font-semibold transition hover:opacity-90',
                                style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
                            }, 'Add System Prompt')
                        ]),
                        React.createElement('div', {
                            key: 'roles-list',
                            className: 'space-y-2 text-center'
                        }, systemPrompt ? React.createElement('div', {
                            key: 'role',
                            className: 'p-3 rounded-lg inline-block text-left',
                            style: { background: 'var(--bg-elevated)', border: '1px solid rgba(92, 49, 30, 0.12)' }
                        }, [
                            React.createElement('div', {
                                key: 'role-name',
                                className: 'text-sm font-semibold',
                                style: { color: '#2b1d14' }
                            }, 'System Prompt'),
                            React.createElement('div', {
                                key: 'role-prompt',
                                className: 'text-xs mt-1',
                                style: { color: 'rgba(43, 29, 20, 0.65)' }
                            }, systemPrompt)
                        ]) : React.createElement('p', {
                            className: 'text-xs',
                            style: { color: 'rgba(43, 29, 20, 0.45)' }
                        }, 'No system prompt set.'))
                    ])
                ]
            ]),

            // Center - Test Routing Graph
            React.createElement('div', {
                key: 'center-panel',
                className: 'flex-1 flex flex-col overflow-hidden'
            }, [
                React.createElement('div', {
                    key: 'test-header',
                    className: 'p-4 border-b',
                    style: { borderColor: 'rgba(92, 49, 30, 0.12)' }
                }, [
                    React.createElement('h3', {
                        key: 'title',
                        className: 'text-xs font-semibold uppercase tracking-wider mb-3',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Test Routing'),
                    React.createElement('div', {
                        key: 'prompt-label',
                        className: 'text-xs mb-2',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Type a prompt to test routing...'),
                    React.createElement('div', {
                        key: 'input-container',
                        className: 'flex gap-2'
                    }, [
                        React.createElement('input', {
                            key: 'input',
                            type: 'text',
                            value: testPrompt,
                            onChange: e => setTestPrompt(e.target.value),
                            placeholder: 'Write a complex Python script for data analysis.',
                            className: 'flex-1 px-4 py-3 rounded-xl border text-sm',
                            style: { borderColor: 'rgba(92, 49, 30, 0.15)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                        }),
                        React.createElement('button', {
                            key: 'send',
                            type: 'button',
                            onClick: handleTestRoute,
                            disabled: isTestingRoute,
                            className: 'w-11 h-11 rounded-xl flex items-center justify-center transition hover:opacity-90 disabled:opacity-50',
                            style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8', fontSize: '1.2rem', fontWeight: '700' }
                        }, '↑')
                    ])
                ]),
                React.createElement('div', {
                    key: 'graph',
                    ref: containerRef,
                    className: 'flex-1 relative overflow-hidden'
                }, [
                    React.createElement(MeshLensBackground, { key: 'mesh' }),
                    React.createElement('div', {
                        key: 'nodes',
                        className: 'absolute inset-0 flex items-center justify-center p-4',
                        style: { transform: 'scale(0.85)' }
                    }, [
                        // User Prompt (leftmost)
                        React.createElement('div', {
                            key: 'user-prompt',
                            className: 'mr-6'
                        }, React.createElement(MiniNodeCard, {
                            title: 'User Prompt',
                            subtitle: 'Input',
                            accent: '#5b2a1a',
                            nodeRef: userPromptRef,
                            onClick: () => openNodePopup('userPrompt', userPromptRef)
                        })),
                        // Special Rules
                        React.createElement('div', {
                            key: 'special-rules',
                            className: 'mr-6'
                        }, React.createElement(MiniNodeCard, {
                            title: 'Special Rules',
                            subtitle: rules.length ? `${rules.length} rule${rules.length > 1 ? 's' : ''}` : 'No rules',
                            accent: '#8e3c2c',
                            nodeRef: specialRulesRef,
                            onClick: () => openNodePopup('specialRules', specialRulesRef)
                        })),
                        // Weight nodes
                        React.createElement('div', {
                            key: 'weights',
                            className: 'flex flex-col gap-3 mr-8'
                        }, weights.map(w => React.createElement(MiniNodeCard, {
                            key: w.id,
                            title: w.label,
                            subtitle: `${Math.round(w.weight * 100)}%`,
                            accent: siteColors.quality,
                            nodeRef: el => leftRefs.current[w.id] = el,
                            onClick: () => openNodePopup('weight', { current: leftRefs.current[w.id] }, { weight: w })
                        }))),
                        // Router node
                        React.createElement('div', {
                            key: 'router',
                            className: 'mx-8'
                        }, React.createElement(MiniNodeCard, {
                            title: 'Restruct Router',
                            subtitle: 'Weighted orchestration',
                            accent: siteColors.router,
                            active: true,
                            nodeRef: centerRef,
                            onClick: () => openNodePopup('router', centerRef)
                        })),
                        // Models node (single, clickable)
                        React.createElement('div', {
                            key: 'models',
                            className: 'ml-8'
                        }, React.createElement(MiniNodeCard, {
                            title: 'Model pool',
                            subtitle: (() => {
                                const totalModels = activeProviders.reduce((sum, p) => {
                                    const enabledCount = Object.values(p.enabledModels || {}).filter(Boolean).length;
                                    return sum + enabledCount;
                                }, 0);
                                return `${totalModels} model${totalModels !== 1 ? 's' : ''}`;
                            })(),
                            accent: siteColors.cost,
                            nodeRef: modelsNodeRef,
                            onClick: () => setModelsModalOpen(true),
                            large: true
                        }))
                    ]),
                    // SVG edges
                    React.createElement('svg', {
                        key: 'svg',
                        className: 'pointer-events-none absolute inset-0',
                        width: '100%',
                        height: '100%'
                    }, (() => {
                        const edges = [];

                        // 1. User Prompt -> Special Rules
                        const userPrompt = nodePositions.userPrompt;
                        const specialRules = nodePositions.specialRules;
                        if (userPrompt && specialRules) {
                            const d = `M ${userPrompt.x} ${userPrompt.y} L ${specialRules.left} ${specialRules.y}`;
                            edges.push(React.createElement('path', {
                                key: 'userPrompt-specialRules',
                                d,
                                fill: 'none',
                                stroke: animatingEdges ? '#c4836a' : siteColors.edgeIdle,
                                strokeWidth: animatingEdges ? 2.5 : 1.5,
                                strokeDasharray: '6 6',
                                style: animatingEdges ? {
                                    animation: 'routeFlow 1.5s linear infinite',
                                    animationDelay: '0s',
                                    opacity: 0.8
                                } : {}
                            }));
                        }

                        // 2. Special Rules -> Weight nodes
                        if (specialRules) {
                            weights.forEach((w, idx) => {
                                const weightNode = nodePositions[w.id];
                                if (!weightNode) return;
                                const d = `M ${specialRules.x} ${specialRules.y} C ${specialRules.x + 40} ${specialRules.y}, ${weightNode.left - 40} ${weightNode.y}, ${weightNode.left} ${weightNode.y}`;
                                edges.push(React.createElement('path', {
                                    key: `specialRules-${w.id}`,
                                    d,
                                    fill: 'none',
                                    stroke: animatingEdges ? '#c4836a' : siteColors.edgeIdle,
                                    strokeWidth: animatingEdges ? 2.5 : 1.5,
                                    strokeDasharray: '6 6',
                                    style: animatingEdges ? {
                                        animation: 'routeFlow 1.5s linear infinite',
                                        animationDelay: `${0.3}s`,
                                        opacity: 0.8
                                    } : {}
                                }));
                            });
                        }

                        // 3. Weight nodes -> Router
                        const router = nodePositions.router;
                        if (router) {
                            weights.forEach(w => {
                                const weightNode = nodePositions[w.id];
                                if (!weightNode) return;
                                const d = `M ${weightNode.x} ${weightNode.y} C ${weightNode.x + 50} ${weightNode.y}, ${router.left - 50} ${router.y}, ${router.left} ${router.y}`;
                                edges.push(React.createElement('path', {
                                    key: `weight-router-${w.id}`,
                                    d,
                                    fill: 'none',
                                    stroke: animatingEdges ? '#c4836a' : siteColors.edgeIdle,
                                    strokeWidth: animatingEdges ? 2.5 : 1.5,
                                    strokeDasharray: '6 6',
                                    style: animatingEdges ? {
                                        animation: 'routeFlow 1.5s linear infinite',
                                        animationDelay: '0.6s',
                                        opacity: 0.8
                                    } : {}
                                }));
                            });

                            // 4. Router -> Models node
                            const modelsNode = nodePositions.models;
                            if (modelsNode) {
                                const d = `M ${router.right} ${router.y} L ${modelsNode.x} ${modelsNode.y}`;
                                edges.push(React.createElement('path', {
                                    key: 'router-models',
                                    d,
                                    fill: 'none',
                                    stroke: animatingEdges ? '#8b4f3f' : siteColors.edgeIdle,
                                    strokeWidth: animatingEdges ? 3 : 1.5,
                                    strokeDasharray: '6 6',
                                    style: animatingEdges ? {
                                        animation: 'routeFlow 1.5s linear infinite',
                                        animationDelay: '0.9s',
                                        opacity: 1
                                    } : {}
                                }));
                            }
                        }

                        return edges;
                    })())
                ])
            ]),

            // Right panel - Profile Summary
            React.createElement('div', {
                key: 'right-panel',
                className: 'w-64 border-l p-5 overflow-hidden flex-shrink-0',
                style: { borderColor: 'rgba(92, 49, 30, 0.12)', backgroundColor: 'rgba(92, 49, 30, 0.02)' }
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: 'text-xs font-semibold uppercase tracking-wider mb-4',
                    style: { color: 'rgba(43, 29, 20, 0.5)' }
                }, 'Profile Summary'),
                React.createElement('input', {
                    key: 'name',
                    type: 'text',
                    value: profileName,
                    onChange: e => setProfileName(e.target.value),
                    placeholder: 'Profile Name',
                    className: 'w-full px-3 py-2 rounded-lg border text-sm mb-3',
                    style: { borderColor: 'rgba(92, 49, 30, 0.15)', backgroundColor: 'var(--bg-elevated)', color: '#2b1d14' }
                }),
                React.createElement('input', {
                    key: 'desc',
                    type: 'text',
                    value: description,
                    onChange: e => setDescription(e.target.value),
                    placeholder: 'Description',
                    className: 'w-full px-3 py-2 rounded-lg border text-sm mb-5',
                    style: { borderColor: 'rgba(92, 49, 30, 0.15)', backgroundColor: 'var(--bg-elevated)', color: '#2b1d14' }
                }),

                React.createElement('div', {
                    key: 'weight-section',
                    className: 'mb-5'
                }, [
                    React.createElement('p', {
                        key: 'label',
                        className: 'text-xs mb-2',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Current weight'),
                    React.createElement(WeightBarChart, { key: 'chart', weights: weights })
                ]),

                React.createElement('div', {
                    key: 'rules-section',
                    className: 'mb-4'
                }, [
                    React.createElement('p', {
                        key: 'label',
                        className: 'text-xs mb-2',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Active Rules'),
                    React.createElement('div', {
                        key: 'list',
                        className: 'text-xs space-y-1',
                        style: { color: '#2b1d14' }
                    }, rules.length > 0 ? rules.map(r => React.createElement('div', { key: r.id }, r.name)) : React.createElement('span', { style: { color: 'rgba(43, 29, 20, 0.4)' } }, 'None'))
                ]),

                testResult && React.createElement('div', {
                    key: 'test-result-section',
                    className: 'mb-5 p-4 rounded-xl',
                    style: {
                        background: 'linear-gradient(135deg, rgba(196, 131, 106, 0.08), rgba(139, 79, 63, 0.08))',
                        border: '2px solid rgba(139, 79, 63, 0.2)'
                    }
                }, [
                    React.createElement('div', {
                        key: 'header',
                        className: 'flex items-center gap-2 mb-3'
                    }, [
                        React.createElement('span', {
                            key: 'icon',
                            style: { fontSize: '16px' }
                        }, '✓'),
                        React.createElement('p', {
                            key: 'title',
                            className: 'text-sm font-semibold',
                            style: { color: '#5b2a1a' }
                        }, 'Test Result')
                    ]),
                    React.createElement('div', {
                        key: 'model',
                        className: 'mb-2'
                    }, [
                        React.createElement('p', {
                            key: 'label',
                            className: 'text-xs mb-1',
                            style: { color: 'rgba(43, 29, 20, 0.6)' }
                        }, 'Selected Model'),
                        React.createElement('p', {
                            key: 'value',
                            className: 'text-sm font-semibold',
                            style: { color: '#2b1d14' }
                        }, testResult.selected_model?.display_name || testResult.selected_model?.model_name)
                    ]),
                    React.createElement('div', {
                        key: 'provider',
                        className: 'text-xs',
                        style: { color: 'rgba(43, 29, 20, 0.6)' }
                    }, `Provider: ${testResult.selected_model?.vendor}`)
                ]),

                testResult && React.createElement('div', {
                    key: 'top-models',
                    className: 'p-3 rounded-lg text-xs',
                    style: { backgroundColor: 'rgba(92, 49, 30, 0.04)', border: '1px solid rgba(92, 49, 30, 0.1)' }
                }, [
                    React.createElement('p', {
                        key: 'title',
                        className: 'font-semibold mb-2',
                        style: { color: '#2b1d14' }
                    }, 'Top Scoring Models'),
                    React.createElement('div', {
                        key: 'list',
                        className: 'space-y-1.5'
                    }, (testResult.all_models || []).slice(0, 5).map((model, index) => React.createElement('div', {
                        key: index,
                        className: 'flex items-center justify-between',
                        style: {
                            color: index === 0 ? '#8b4f3f' : 'rgba(43, 29, 20, 0.7)',
                            fontWeight: index === 0 ? '600' : '400'
                        }
                    }, [
                        React.createElement('span', {
                            key: 'rank',
                            className: 'mr-1',
                            style: { color: 'rgba(43, 29, 20, 0.4)', minWidth: '16px' }
                        }, `${index + 1}.`),
                        React.createElement('span', {
                            key: 'name',
                            className: 'flex-1'
                        }, model.display_name || model.model_name),
                        index === 0 && React.createElement('span', {
                            key: 'badge',
                            className: 'text-[10px] px-1.5 py-0.5 rounded',
                            style: { backgroundColor: 'rgba(139, 79, 63, 0.15)', color: '#8b4f3f' }
                        }, 'SELECTED')
                    ])))
                ])
            ])
        ]),

        // Rule Editor Modal
        React.createElement(RuleEditorModal, {
            key: 'rule-modal',
            isOpen: ruleModalOpen,
            onClose: () => setRuleModalOpen(false),
            onSave: addRule
        }),

        // Local Models Info Modal
        React.createElement(LocalModelsInfoModal, {
            key: 'local-models-modal',
            isOpen: localModelsModalOpen,
            onClose: () => setLocalModelsModalOpen(false),
            onEnable: handleEnableLocalModels
        }),

        // Models Selection Modal
        modelsModalOpen && React.createElement('div', {
            key: 'models-modal',
            className: 'fixed inset-0 flex items-center justify-center z-50',
            style: { backgroundColor: 'rgba(0,0,0,0.5)' },
            onClick: () => setModelsModalOpen(false)
        }, React.createElement('div', {
            className: 'bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col',
            style: { color: '#2b1d14' },
            onClick: e => e.stopPropagation()
        }, [
            // Header
            React.createElement('div', {
                key: 'header',
                className: 'flex items-center justify-between mb-4'
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: 'text-xl font-semibold',
                    style: { color: '#5b2a1a' }
                }, 'Select Models'),
                React.createElement('button', {
                    key: 'close',
                    type: 'button',
                    onClick: () => setModelsModalOpen(false),
                    className: 'text-2xl leading-none',
                    style: { color: 'rgba(43,29,20,0.5)' }
                }, '×')
            ]),

            // Search and controls
            React.createElement('div', {
                key: 'controls',
                className: 'flex gap-3 mb-4'
            }, [
                React.createElement('input', {
                    key: 'search',
                    type: 'text',
                    value: modelSearchQuery,
                    onChange: e => setModelSearchQuery(e.target.value),
                    placeholder: 'Search models or providers...',
                    className: 'flex-1 px-4 py-2 rounded-lg border text-sm',
                    style: { borderColor: 'rgba(92,49,30,0.15)', backgroundColor: 'var(--bg-elevated)', color: '#2b1d14' }
                }),
                React.createElement('button', {
                    key: 'disable-all',
                    type: 'button',
                    onClick: () => setProviders(prev => prev.map(p => ({
                        ...p,
                        enabled: false,
                        enabledModels: p.models.reduce((acc, model) => ({ ...acc, [model]: false }), {})
                    }))),
                    className: 'px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap',
                    style: { background: 'rgba(92,49,30,0.08)', color: '#5b2a1a' }
                }, 'Disable All'),
                React.createElement('button', {
                    key: 'enable-all',
                    type: 'button',
                    onClick: () => setProviders(prev => prev.map(p => ({
                        ...p,
                        enabled: true,
                        enabledModels: p.models.reduce((acc, model) => ({ ...acc, [model]: true }), {})
                    }))),
                    className: 'px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap',
                    style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
                }, 'Enable All')
            ]),

            // Provider list
            React.createElement('div', {
                key: 'provider-list',
                className: 'overflow-y-auto flex-1',
                style: { paddingRight: '8px' }
            }, (() => {
                const searchLower = modelSearchQuery.toLowerCase();
                const filtered = providers.filter(p => {
                    if (!searchLower) return true;
                    const labelMatch = p.label.toLowerCase().includes(searchLower);
                    const modelMatch = p.models.some(m => m.toLowerCase().includes(searchLower));
                    return labelMatch || modelMatch;
                });

                if (filtered.length === 0) {
                    return React.createElement('div', {
                        className: 'text-center py-8 text-sm',
                        style: { color: 'rgba(43,29,20,0.4)' }
                    }, 'No models found');
                }

                return filtered.map(provider => {
                    const isExpanded = expandedProviders[provider.id];
                    const enabledModelCount = Object.values(provider.enabledModels || {}).filter(Boolean).length;

                    return React.createElement('div', {
                        key: provider.id,
                        className: 'mb-4 rounded-xl border transition-all',
                        style: {
                            borderColor: provider.enabled ? 'rgba(139,79,63,0.2)' : 'rgba(92,49,30,0.1)',
                            backgroundColor: provider.enabled ? 'rgba(196,131,106,0.04)' : 'transparent'
                        }
                    }, [
                        // Provider header (clickable to expand)
                        React.createElement('div', {
                            key: 'header',
                            className: 'flex items-center justify-between p-4 cursor-pointer',
                            onClick: () => setExpandedProviders(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))
                        }, [
                            React.createElement('div', {
                                key: 'info',
                                className: 'flex items-center gap-3'
                            }, [
                                React.createElement('div', {
                                    key: 'icon',
                                    className: 'w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg',
                                    style: { backgroundColor: provider.color || '#8b4f3f' }
                                }, provider.icon),
                                React.createElement('div', {
                                    key: 'text'
                                }, [
                                    React.createElement('p', {
                                        key: 'label',
                                        className: 'font-semibold text-base',
                                        style: { color: '#2b1d14' }
                                    }, provider.label),
                                    React.createElement('p', {
                                        key: 'count',
                                        className: 'text-xs',
                                        style: { color: 'rgba(43,29,20,0.5)' }
                                    }, `${enabledModelCount}/${provider.models.length} models enabled`)
                                ])
                            ]),
                            React.createElement('div', {
                                key: 'controls',
                                className: 'flex items-center gap-2'
                            }, [
                                React.createElement('span', {
                                    key: 'chevron',
                                    className: 'text-lg transition-transform',
                                    style: {
                                        color: 'rgba(43,29,20,0.4)',
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                    }
                                }, '▼'),
                                React.createElement('button', {
                                    key: 'toggle',
                                    type: 'button',
                                    onClick: (e) => {
                                        e.stopPropagation();
                                        setProviders(prev => prev.map(p =>
                                            p.id === provider.id ? {
                                                ...p,
                                                enabled: !p.enabled,
                                                enabledModels: p.models.reduce((acc, model) => ({
                                                    ...acc,
                                                    [model]: !p.enabled
                                                }), {})
                                            } : p
                                        ));
                                    },
                                    className: 'relative w-12 h-6 rounded-full transition-colors',
                                    style: {
                                        backgroundColor: provider.enabled ? '#8b4f3f' : 'rgba(92,49,30,0.2)'
                                    }
                                }, React.createElement('div', {
                                    className: 'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow',
                                    style: {
                                        transform: provider.enabled ? 'translateX(24px)' : 'translateX(2px)'
                                    }
                                }))
                            ])
                        ]),

                        // Expanded models list
                        isExpanded && React.createElement('div', {
                            key: 'models',
                            className: 'px-4 pb-4 space-y-2'
                        }, provider.models.map(model => {
                            const modelEnabled = provider.enabledModels?.[model] ?? true;
                            return React.createElement('div', {
                                key: model,
                                className: 'flex items-center justify-between p-3 rounded-lg border',
                                style: {
                                    borderColor: modelEnabled ? 'rgba(139,79,63,0.15)' : 'rgba(92,49,30,0.08)',
                                    backgroundColor: modelEnabled ? 'rgba(196,131,106,0.05)' : 'transparent'
                                }
                            }, [
                                React.createElement('span', {
                                    key: 'name',
                                    className: 'text-sm font-medium',
                                    style: { color: modelEnabled ? '#2b1d14' : 'rgba(43,29,20,0.4)' }
                                }, model),
                                React.createElement('button', {
                                    key: 'toggle',
                                    type: 'button',
                                    onClick: () => {
                                        setProviders(prev => prev.map(p =>
                                            p.id === provider.id ? {
                                                ...p,
                                                enabledModels: {
                                                    ...p.enabledModels,
                                                    [model]: !modelEnabled
                                                },
                                                enabled: Object.values({
                                                    ...p.enabledModels,
                                                    [model]: !modelEnabled
                                                }).some(Boolean)
                                            } : p
                                        ));
                                    },
                                    className: 'relative w-10 h-5 rounded-full transition-colors',
                                    style: {
                                        backgroundColor: modelEnabled ? '#8b4f3f' : 'rgba(92,49,30,0.2)'
                                    }
                                }, React.createElement('div', {
                                    className: 'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow',
                                    style: {
                                        transform: modelEnabled ? 'translateX(20px)' : 'translateX(2px)'
                                    }
                                }))
                            ]);
                        }))
                    ]);
                })
            })())
        ])),

        systemPromptModalOpen && React.createElement('div', {
            key: 'system-prompt-modal',
            className: 'fixed inset-0 flex items-center justify-center',
            style: { backgroundColor: 'rgba(0,0,0,0.45)' },
            onClick: () => setSystemPromptModalOpen(false)
        }, React.createElement('div', {
            className: 'bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl',
            style: { color: '#2b1d14' },
            onClick: e => e.stopPropagation()
        }, [
            React.createElement('h3', {
                key: 'title',
                className: 'text-lg font-semibold mb-3',
                style: { color: '#5b2a1a' }
            }, 'Define a system prompt for all models'),
            React.createElement('p', {
                key: 'subtitle',
                className: 'text-sm mb-3',
                style: { color: 'rgba(43,29,20,0.65)' }
            }, 'This prompt will be applied as the system message for every model in this profile.'),
            React.createElement('textarea', {
                key: 'input',
                value: systemPromptDraft,
                onChange: e => setSystemPromptDraft(e.target.value),
                rows: 5,
                className: 'w-full p-3 rounded-lg border text-sm',
                style: { borderColor: 'rgba(92,49,30,0.15)', color: '#2b1d14', resize: 'vertical' },
                placeholder: 'ex: Act as a lawyer and cite every prompt.'
            }),
            React.createElement('div', {
                key: 'actions',
                className: 'flex justify-end gap-2 mt-4'
            }, [
                React.createElement('button', {
                    key: 'cancel',
                    type: 'button',
                    onClick: () => setSystemPromptModalOpen(false),
                    className: 'px-4 py-2 rounded-lg text-sm font-semibold',
                    style: { background: 'rgba(92,49,30,0.08)', color: '#5b2a1a' }
                }, 'Cancel'),
                React.createElement('button', {
                    key: 'save',
                    type: 'button',
                    onClick: saveSystemPrompt,
                    className: 'px-4 py-2 rounded-lg text-sm font-semibold',
                    style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
                }, 'Save')
            ])
        ])),

        // Node Popup Editor
        activePopup && React.createElement('div', {
            key: 'popup-overlay',
            className: 'fixed inset-0 z-40',
            style: { backgroundColor: activePopup.fullscreen ? 'rgba(0,0,0,0.5)' : 'transparent', pointerEvents: activePopup.fullscreen ? 'auto' : 'none' },
            onClick: (e) => {
                if (e.target === e.currentTarget) closePopup();
            }
        }, React.createElement('div', {
            className: activePopup.fullscreen ? 'fixed inset-0 flex items-center justify-center p-8' : 'absolute',
            style: activePopup.fullscreen ? {} : {
                left: `${activePopup.position.x}px`,
                top: `${activePopup.position.y}px`,
                pointerEvents: 'auto'
            },
            onClick: (e) => e.stopPropagation()
        }, React.createElement('div', {
            className: 'bg-white rounded-2xl shadow-2xl border-2 flex flex-col',
            style: {
                borderColor: 'rgba(139,79,63,0.2)',
                width: activePopup.fullscreen ? '100%' : '380px',
                maxWidth: activePopup.fullscreen ? '900px' : '380px',
                maxHeight: activePopup.fullscreen ? '100%' : '500px',
                color: '#2b1d14'
            }
        }, [
            // Header with controls
            React.createElement('div', {
                key: 'header',
                className: 'flex items-center justify-between px-5 py-4 border-b',
                style: { borderColor: 'rgba(92,49,30,0.1)' }
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: 'text-lg font-semibold',
                    style: { color: '#5b2a1a' }
                }, (() => {
                    if (activePopup.type === 'userPrompt') return 'Edit Test Prompt';
                    if (activePopup.type === 'specialRules') return 'Special Rules';
                    if (activePopup.type === 'weight') return `Edit ${activePopup.data.weight?.label}`;
                    if (activePopup.type === 'router') return 'Router Settings';
                    return 'Edit';
                })()),
                React.createElement('div', {
                    key: 'controls',
                    className: 'flex gap-2'
                }, [
                    React.createElement('button', {
                        key: 'fullscreen',
                        type: 'button',
                        onClick: toggleFullscreen,
                        className: 'w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-gray-100',
                        style: { color: 'rgba(43,29,20,0.5)' }
                    }, activePopup.fullscreen ? '⊡' : '⛶'),
                    React.createElement('button', {
                        key: 'close',
                        type: 'button',
                        onClick: closePopup,
                        className: 'w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-gray-100 text-xl',
                        style: { color: 'rgba(43,29,20,0.5)' }
                    }, '×')
                ])
            ]),

            // Content
            React.createElement('div', {
                key: 'content',
                className: 'flex-1 overflow-y-auto p-5'
            }, (() => {
                // User Prompt popup
                if (activePopup.type === 'userPrompt') {
                    return [
                        React.createElement('p', {
                            key: 'label',
                            className: 'text-sm mb-3',
                            style: { color: 'rgba(43,29,20,0.65)' }
                        }, 'Enter a test prompt to see which model the router selects based on your configured weights and rules.'),
                        React.createElement('textarea', {
                            key: 'input',
                            value: testPromptDraft || testPrompt,
                            onChange: e => setTestPromptDraft(e.target.value),
                            rows: 6,
                            placeholder: 'Write a complex Python script for data analysis.',
                            className: 'w-full p-3 rounded-lg border text-sm',
                            style: { borderColor: 'rgba(92,49,30,0.15)', color: '#2b1d14', resize: 'vertical' }
                        }),
                        React.createElement('div', {
                            key: 'actions',
                            className: 'flex gap-2 mt-4'
                        }, [
                            React.createElement('button', {
                                key: 'apply',
                                type: 'button',
                                onClick: () => {
                                    setTestPrompt(testPromptDraft || testPrompt);
                                    closePopup();
                                },
                                className: 'flex-1 py-2 rounded-lg text-sm font-semibold',
                                style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
                            }, 'Apply'),
                            React.createElement('button', {
                                key: 'test',
                                type: 'button',
                                onClick: () => {
                                    setTestPrompt(testPromptDraft || testPrompt);
                                    closePopup();
                                    setTimeout(() => handleTestRoute(), 100);
                                },
                                className: 'flex-1 py-2 rounded-lg text-sm font-semibold',
                                style: { background: 'rgba(92,49,30,0.08)', color: '#5b2a1a' }
                            }, 'Test Now')
                        ])
                    ];
                }

                // Special Rules popup
                if (activePopup.type === 'specialRules') {
                    return [
                        React.createElement('p', {
                            key: 'label',
                            className: 'text-sm mb-3',
                            style: { color: 'rgba(43,29,20,0.65)' }
                        }, 'Add conditional rules to override model selection based on specific criteria.'),
                        React.createElement('div', {
                            key: 'rules-list',
                            className: 'space-y-2 mb-4'
                        }, rules.length > 0 ? rules.map((rule, idx) => React.createElement('div', {
                            key: idx,
                            className: 'p-3 rounded-lg border flex items-center justify-between',
                            style: { borderColor: 'rgba(92,49,30,0.15)' }
                        }, [
                            React.createElement('div', { key: 'info' }, [
                                React.createElement('p', {
                                    key: 'name',
                                    className: 'text-sm font-semibold',
                                    style: { color: '#2b1d14' }
                                }, rule.name),
                                React.createElement('p', {
                                    key: 'condition',
                                    className: 'text-xs',
                                    style: { color: 'rgba(43,29,20,0.5)' }
                                }, rule.condition)
                            ]),
                            React.createElement('button', {
                                key: 'delete',
                                type: 'button',
                                onClick: () => setRules(rules.filter((_, i) => i !== idx)),
                                className: 'text-sm px-2 py-1 rounded',
                                style: { color: '#8b4f3f' }
                            }, '×')
                        ])) : React.createElement('p', {
                            className: 'text-sm text-center py-4',
                            style: { color: 'rgba(43,29,20,0.4)' }
                        }, 'No rules yet')),
                        React.createElement('button', {
                            key: 'add',
                            type: 'button',
                            onClick: () => {
                                setRuleModalOpen(true);
                                closePopup();
                            },
                            className: 'w-full py-2 rounded-lg text-sm font-semibold',
                            style: { background: 'linear-gradient(135deg, #c4836a, #8b4f3f)', color: '#fffcf8' }
                        }, '+ Add Rule')
                    ];
                }

                // Weight popup
                if (activePopup.type === 'weight' && activePopup.data.weight) {
                    const weight = activePopup.data.weight;
                    const currentValue = Math.round(weight.weight * 100);
                    return [
                        React.createElement('p', {
                            key: 'label',
                            className: 'text-sm mb-3',
                            style: { color: 'rgba(43,29,20,0.65)' }
                        }, `Adjust the ${weight.label.toLowerCase()} weight. Higher values prioritize this factor in model selection.`),
                        React.createElement('div', {
                            key: 'value',
                            className: 'text-center mb-4'
                        }, [
                            React.createElement('div', {
                                key: 'num',
                                className: 'text-5xl font-bold mb-2',
                                style: { color: '#8b4f3f' }
                            }, `${currentValue}%`),
                            React.createElement('input', {
                                key: 'slider',
                                type: 'range',
                                min: 0,
                                max: 100,
                                value: currentValue,
                                onChange: (e) => {
                                    const newValue = parseInt(e.target.value) / 100;
                                    setWeights(weights.map(w =>
                                        w.id === weight.id ? { ...w, weight: newValue } : w
                                    ));
                                },
                                className: 'w-full',
                                style: { accentColor: '#8b4f3f' }
                            })
                        ]),
                        React.createElement('div', {
                            key: 'info',
                            className: 'p-3 rounded-lg text-xs',
                            style: { backgroundColor: 'rgba(196,131,106,0.08)', color: 'rgba(43,29,20,0.6)' }
                        }, 'Note: Weight values are relative. The router normalizes all weights to determine model selection.')
                    ];
                }

                // Router popup
                if (activePopup.type === 'router') {
                    return [
                        React.createElement('p', {
                            key: 'label',
                            className: 'text-sm mb-3',
                            style: { color: 'rgba(43,29,20,0.65)' }
                        }, 'The router uses weighted orchestration to select the best model for each request.'),
                        React.createElement('div', {
                            key: 'summary',
                            className: 'space-y-3'
                        }, [
                            React.createElement('div', {
                                key: 'weights',
                                className: 'p-4 rounded-lg',
                                style: { backgroundColor: 'rgba(196,131,106,0.08)' }
                            }, [
                                React.createElement('p', {
                                    key: 'title',
                                    className: 'text-sm font-semibold mb-2',
                                    style: { color: '#5b2a1a' }
                                }, 'Current Weights'),
                                ...weights.map(w => React.createElement('div', {
                                    key: w.id,
                                    className: 'flex justify-between text-sm mb-1'
                                }, [
                                    React.createElement('span', {
                                        key: 'label',
                                        style: { color: 'rgba(43,29,20,0.7)' }
                                    }, w.label),
                                    React.createElement('span', {
                                        key: 'value',
                                        className: 'font-semibold',
                                        style: { color: '#8b4f3f' }
                                    }, `${Math.round(w.weight * 100)}%`)
                                ]))
                            ]),
                            React.createElement('div', {
                                key: 'models',
                                className: 'p-4 rounded-lg',
                                style: { backgroundColor: 'rgba(196,131,106,0.08)' }
                            }, [
                                React.createElement('p', {
                                    key: 'title',
                                    className: 'text-sm font-semibold mb-2',
                                    style: { color: '#5b2a1a' }
                                }, 'Active Providers'),
                                React.createElement('p', {
                                    key: 'count',
                                    className: 'text-sm',
                                    style: { color: 'rgba(43,29,20,0.7)' }
                                }, `${activeProviders.length} provider${activeProviders.length !== 1 ? 's' : ''} enabled`)
                            ])
                        ])
                    ];
                }

                return null;
            })())
        ]))),

        // Toast notification
        toast && React.createElement(Toast, {
            key: 'toast',
            message: toast.message,
            type: toast.type,
            onClose: () => setToast(null)
        })
    ]);
}

const rootElement = document.getElementById('profileBuilderReactRoot');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(React.createElement(ProfileBuilderShell));
}
