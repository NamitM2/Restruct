const React = window.React;
const { useState, useEffect, useMemo, useRef } = React;
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

const familyPresets = [
    { id: 'openai', label: 'OpenAI', accent: '#b56747', models: ['GPT-4.1', 'GPT-4o mini', 'o1-preview'] },
    { id: 'anthropic', label: 'Anthropic', accent: '#c98454', models: ['Claude 3 Opus', 'Claude 3 Haiku', 'Claude 3.5 Sonnet'] },
    { id: 'google', label: 'Google', accent: '#8e3c2c', models: ['Gemini 2.5 Pro', 'Gemini 1.5 Flash', 'Gemini Nano'] },
    { id: 'mistral', label: 'Mistral', accent: '#d0b190', models: ['Mistral Large', 'Mistral Small', 'Mixtral 8x7b'] },
    { id: 'local', label: 'Local Models', accent: '#b56747', models: ['Llama 3 Local', 'Phi-4 Local', 'Custom QLoRA'] },
    { id: 'specialized', label: 'Specialized Models', accent: '#c98454', models: ['Legal FT', 'Support FT', 'Creative FT'] },
];

const defaultPriorities = [
    { id: 'cost', label: 'Cost', subtitle: 'Spend efficiency', weight: 0.35, accent: siteColors.cost },
    { id: 'quality', label: 'Quality', subtitle: 'Model fidelity', weight: 0.45, accent: siteColors.quality },
    { id: 'latency', label: 'Latency', subtitle: 'Response speed', weight: 0.20, accent: siteColors.latency },
];

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

const NodeCard = ({ title, subtitle, accent, onClick, active, nodeRef }) => {
    const [isHovered, setIsHovered] = useState(false);

    return React.createElement('button', {
        ref: nodeRef,
        type: 'button',
        onClick,
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        className: `relative w-full overflow-hidden rounded-xl border px-3 py-1.5 text-left transition-all ${
            active ? 'bg-white border-[#8e3c2c] shadow-lg' : 'bg-white border-[rgba(92,49,30,0.12)]'
        }`,
        style: {
            boxShadow: active ? '0 6px 16px rgba(92, 49, 30, 0.12)' : '0 3px 8px rgba(92, 49, 30, 0.06)',
            transform: isHovered ? 'scale(1.02)' : 'scale(1)',
            backgroundColor: '#ffffff',
        }
    }, [
        React.createElement('div', {
            key: 'bg',
            className: 'pointer-events-none absolute inset-0 opacity-15',
            style: { background: `radial-gradient(circle at top, ${accent}40, transparent)` }
        }),
        React.createElement('div', {
            key: 'content',
            className: 'relative flex flex-col gap-0.5'
        }, [
            React.createElement('p', {
                key: 'title',
                className: 'text-sm font-semibold',
                style: { color: '#2b1d14' }
            }, title),
            subtitle && React.createElement('p', {
                key: 'subtitle',
                className: 'text-xs',
                style: { color: 'rgba(43, 29, 20, 0.6)' }
            }, subtitle)
        ])
    ]);
};

const EdgePopover = ({ edge, position, onClose, onWeightUpdate, onToggleConnection }) => {
    if (!edge) return null;

    return React.createElement('div', {
        className: 'absolute z-30 w-64 rounded-2xl border bg-white p-4 shadow-2xl',
        style: {
            left: position.x,
            top: position.y,
            transform: 'translate(-50%, -120%)',
            borderColor: 'rgba(92, 49, 30, 0.2)',
            color: '#2b1d14',
        }
    }, [
        React.createElement('div', {
            key: 'header',
            className: 'mb-2 flex items-center justify-between text-sm font-semibold'
        }, [
            React.createElement('span', { key: 'label' }, edge.label),
            React.createElement('button', {
                key: 'close',
                type: 'button',
                className: 'transition',
                style: { color: 'rgba(43, 29, 20, 0.6)' },
                onClick: onClose
            }, '✕')
        ]),
        edge.type === 'priority' ? [
            React.createElement('p', {
                key: 'weight-label',
                className: 'mb-2 text-xs uppercase tracking-[0.3em]',
                style: { color: 'rgba(43, 29, 20, 0.5)' }
            }, 'Weight'),
            React.createElement('div', {
                key: 'weight-control',
                className: 'flex items-center gap-2'
            }, [
                React.createElement('input', {
                    key: 'slider',
                    type: 'range',
                    min: '0',
                    max: '1',
                    step: '0.05',
                    value: edge.weight,
                    onChange: e => onWeightUpdate(parseFloat(e.target.value)),
                    className: 'h-1 flex-1 appearance-none rounded-full bg-[rgba(92,49,30,0.1)]',
                    style: { accentColor: '#b56747' }
                }),
                React.createElement('span', {
                    key: 'value',
                    className: 'w-12 text-right text-sm font-semibold'
                }, edge.weight.toFixed(2))
            ])
        ] : [
            React.createElement('p', {
                key: 'family-label',
                className: 'mb-2 text-xs uppercase tracking-[0.3em]',
                style: { color: 'rgba(43, 29, 20, 0.5)' }
            }, 'Family Routing'),
            React.createElement('div', {
                key: 'family-control',
                className: 'flex items-center justify-between'
            }, [
                React.createElement('span', { key: 'text', className: 'text-sm' }, 'Enable Path'),
                React.createElement('button', {
                    key: 'toggle',
                    type: 'button',
                    onClick: () => onToggleConnection(!edge.enabled),
                    className: `rounded-full px-3 py-1 text-xs font-semibold transition ${
                        edge.enabled ? 'bg-[rgba(181,103,71,0.15)] text-[#5b2a1a]' : 'bg-[rgba(92,49,30,0.1)] text-[rgba(43,29,20,0.7)]'
                    }`
                }, edge.enabled ? 'Enabled' : 'Disabled')
            ])
        ]
    ]);
};

const FamilyDrawer = ({ family, onClose, onToggle, onBlacklist }) => {
    if (!family) return null;

    return React.createElement('aside', {
        className: 'absolute right-8 top-8 z-40 w-80 rounded-3xl border bg-white p-6 shadow-[0_20px_60px_rgba(92,49,30,0.2)]',
        style: { borderColor: 'rgba(92, 49, 30, 0.12)', color: '#2b1d14' }
    }, [
        React.createElement('div', {
            key: 'header',
            className: 'mb-5 flex items-center justify-between'
        }, [
            React.createElement('div', { key: 'title' }, [
                React.createElement('p', {
                    key: 'label',
                    className: 'text-xs uppercase tracking-[0.3em]',
                    style: { color: 'rgba(43, 29, 20, 0.5)' }
                }, 'Family'),
                React.createElement('p', {
                    key: 'name',
                    className: 'text-xl font-semibold'
                }, family.label)
            ]),
            React.createElement('button', {
                key: 'close',
                type: 'button',
                onClick: onClose,
                className: 'rounded-full border px-2 py-1 text-sm transition',
                style: { borderColor: 'rgba(92, 49, 30, 0.2)', color: 'rgba(43, 29, 20, 0.7)' }
            }, 'Close')
        ]),
        React.createElement('div', {
            key: 'routing-toggle',
            className: 'mb-5 flex items-center justify-between rounded-2xl border px-4 py-3',
            style: { borderColor: 'rgba(92, 49, 30, 0.12)', backgroundColor: 'rgba(92, 49, 30, 0.04)' }
        }, [
            React.createElement('span', { key: 'label', className: 'text-sm' }, 'Routing Enabled'),
            React.createElement('button', {
                key: 'button',
                type: 'button',
                onClick: () => onToggle(!family.enabled),
                className: `rounded-full px-3 py-1 text-xs font-semibold transition ${
                    family.enabled ? 'bg-[rgba(181,103,71,0.15)] text-[#5b2a1a]' : 'bg-[rgba(92,49,30,0.1)] text-[rgba(43,29,20,0.7)]'
                }`
            }, family.enabled ? 'On' : 'Off')
        ]),
        React.createElement('p', {
            key: 'blacklist-label',
            className: 'mb-3 text-xs uppercase tracking-[0.3em]',
            style: { color: 'rgba(43, 29, 20, 0.5)' }
        }, 'Blacklist Models'),
        React.createElement('div', {
            key: 'models',
            className: 'flex flex-col gap-3'
        }, family.models.map(model => {
            const blacklisted = family.blacklist.includes(model);
            return React.createElement('label', {
                key: model,
                className: 'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm',
                style: { borderColor: 'rgba(92, 49, 30, 0.12)', backgroundColor: 'rgba(92, 49, 30, 0.04)' }
            }, [
                React.createElement('span', { key: 'name' }, model),
                React.createElement('button', {
                    key: 'toggle',
                    type: 'button',
                    onClick: () => onBlacklist(model),
                    className: `rounded-full px-3 py-1 text-xs font-semibold transition ${
                        blacklisted ? 'bg-[rgba(142,60,44,0.15)] text-[#8e3c2c]' : 'bg-[rgba(92,49,30,0.1)] text-[rgba(43,29,20,0.7)]'
                    }`
                }, blacklisted ? 'Blacklisted' : 'Allow')
            ]);
        }))
    ]);
};

function ProfileBuilder({ onDismiss, initialOptions }) {
    const [leftNodes, setLeftNodes] = useState(defaultPriorities);
    const [families, setFamilies] = useState(
        familyPresets.map(f => ({ ...f, enabled: true, blacklist: [] }))
    );
    const [profileName, setProfileName] = useState('');
    const [description, setDescription] = useState('');
    const [activeEdge, setActiveEdge] = useState(null);
    const [edgePosition, setEdgePosition] = useState({ x: 0, y: 0 });
    const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
    const [drawerFamilyId, setDrawerFamilyId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [nodePositions, setNodePositions] = useState({});

    const leftRefs = useRef({});
    const centerRef = useRef(null);
    const rightRefs = useRef({});
    const containerRef = useRef(null);

    useEffect(() => {
        if (initialOptions.profile) {
            const { name, description: desc, graph_state } = initialOptions.profile;
            setProfileName(name || '');
            setDescription(desc || '');
            if (graph_state?.priorities) {
                setLeftNodes(graph_state.priorities);
            }
            if (graph_state?.families) {
                setFamilies(graph_state.families);
            }
        }
    }, [initialOptions]);

    useEffect(() => {
        const calculatePositions = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const positions = {};

            leftNodes.forEach(node => {
                const el = leftRefs.current[node.id];
                if (el) {
                    const rect = el.getBoundingClientRect();
                    positions[node.id] = {
                        x: rect.right - containerRect.left,
                        y: rect.top + rect.height / 2 - containerRect.top
                    };
                }
            });

            if (centerRef.current) {
                const rect = centerRef.current.getBoundingClientRect();
                positions.router = {
                    left: rect.left - containerRect.left,
                    right: rect.right - containerRect.left,
                    y: rect.top + rect.height / 2 - containerRect.top
                };
            }

            families.forEach(family => {
                const el = rightRefs.current[family.id];
                if (el) {
                    const rect = el.getBoundingClientRect();
                    positions[family.id] = {
                        x: rect.left - containerRect.left,
                        y: rect.top + rect.height / 2 - containerRect.top
                    };
                }
            });

            setNodePositions(positions);
        };

        calculatePositions();
        window.addEventListener('resize', calculatePositions);
        const timer = setTimeout(calculatePositions, 100);
        return () => {
            window.removeEventListener('resize', calculatePositions);
            clearTimeout(timer);
        };
    }, [leftNodes, families]);

    const edges = useMemo(() => {
        const result = [];
        leftNodes.forEach(node => {
            result.push({
                id: `${node.id}-router`,
                from: node.id,
                to: 'router',
                type: 'priority',
                label: node.label,
                weight: node.weight,
                accent: node.accent,
                visible: true
            });
        });
        families.forEach(family => {
            result.push({
                id: `router-${family.id}`,
                from: 'router',
                to: family.id,
                type: 'family',
                label: family.label,
                enabled: family.enabled,
                accent: family.accent,
                visible: true
            });
        });
        return result;
    }, [leftNodes, families]);

    const handleEdgeClick = (edge, start, end) => {
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        setActiveEdge(edge);
        setEdgePosition({ x: midX, y: midY });
    };

    const updateEdgeWeight = (newWeight) => {
        if (activeEdge && activeEdge.type === 'priority') {
            setLeftNodes(prev =>
                prev.map(node =>
                    node.id === activeEdge.from ? { ...node, weight: newWeight } : node
                )
            );
            setActiveEdge(prev => prev ? { ...prev, weight: newWeight } : prev);
        }
    };

    const updateEdgeEnabled = (enabled) => {
        if (activeEdge && activeEdge.type === 'family') {
            setFamilies(prev =>
                prev.map(f =>
                    f.id === activeEdge.to ? { ...f, enabled } : f
                )
            );
            setActiveEdge(prev => prev ? { ...prev, enabled } : prev);
        }
    };

    const openFamilyDrawer = (familyId) => {
        setDrawerFamilyId(familyId);
    };

    const closeFamilyDrawer = () => {
        setDrawerFamilyId(null);
    };

    const updateFamilyToggle = (enabled) => {
        setFamilies(prev =>
            prev.map(f =>
                f.id === drawerFamilyId ? { ...f, enabled } : f
            )
        );
    };

    const updateBlacklist = (model) => {
        setFamilies(prev =>
            prev.map(f => {
                if (f.id !== drawerFamilyId) return f;
                const blacklisted = f.blacklist.includes(model);
                return {
                    ...f,
                    blacklist: blacklisted
                        ? f.blacklist.filter(m => m !== model)
                        : [...f.blacklist, model]
                };
            })
        );
    };

    const handleSave = async () => {
        if (!profileName.trim()) {
            setError('Profile name is required');
            return;
        }
        setIsSaving(true);
        setError('');
        setSuccess('');

        const graphState = { priorities: leftNodes, families };
        const payload = {
            name: profileName,
            description,
            graph_state: graphState
        };

        try {
            const response = await fetch(`${window.API_URL}/profiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to save profile');
            }
            const saved = await response.json();
            setSuccess('Profile saved successfully!');
            window.dispatchEvent(new CustomEvent('routing-profile:created', { detail: { profile: saved.profile } }));
            setTimeout(() => onDismiss(), 1500);
        } catch (err) {
            console.error('Save profile error:', err);
            setError(err.message || 'Failed to save profile');
        }
        setIsSaving(false);
    };

    useEffect(() => {
        const handleKey = event => {
            if (event.key === 'Escape') {
                onDismiss();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onDismiss]);

    const drawerFamily = families.find(f => f.id === drawerFamilyId);

    return React.createElement('div', {
        className: 'relative h-full w-full flex flex-col',
        style: { opacity: 1, transition: 'opacity 0.3s' },
        onClick: onDismiss
    }, [
        React.createElement('div', {
            key: 'header',
            className: 'px-8 py-6 flex items-center justify-between gap-6',
            style: {
                background: 'linear-gradient(135deg, #f1e5d7, #f6efe7)',
                color: '#2b1d14'
            },
            onClick: e => e.stopPropagation()
        }, [
            React.createElement('div', { key: 'title' }, [
                React.createElement('p', {
                    key: 'label',
                    className: 'text-xs uppercase tracking-[0.35em]',
                    style: { color: 'rgba(43, 29, 20, 0.5)' }
                }, 'Routing Lab'),
                React.createElement('h2', {
                    key: 'heading',
                    className: 'text-3xl font-semibold',
                    style: { color: '#5b2a1a' }
                }, 'Create Routing Profile'),
                React.createElement('p', {
                    key: 'desc',
                    className: 'mt-1 text-sm',
                    style: { color: 'rgba(43, 29, 20, 0.7)' }
                }, 'Tune prompt priorities, route families, and persist to Supabase.')
            ]),
            React.createElement('div', {
                key: 'inputs',
                className: 'flex gap-4'
            }, [
                React.createElement('label', {
                    key: 'name',
                    className: 'flex flex-col rounded-2xl border-2 px-4 py-3 w-56',
                    style: { borderColor: '#8e3c2c', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(92, 49, 30, 0.08)' }
                }, [
                    React.createElement('span', {
                        key: 'label',
                        className: 'text-xs uppercase tracking-[0.35em]',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Profile Name'),
                    React.createElement('input', {
                        key: 'input',
                        type: 'text',
                        value: profileName,
                        onChange: e => setProfileName(e.target.value),
                        className: 'bg-transparent text-lg font-semibold focus:outline-none',
                        style: { color: '#2b1d14' }
                    })
                ]),
                React.createElement('label', {
                    key: 'desc',
                    className: 'flex flex-col rounded-2xl border-2 px-4 py-3 w-56',
                    style: { borderColor: '#8e3c2c', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(92, 49, 30, 0.08)' }
                }, [
                    React.createElement('span', {
                        key: 'label',
                        className: 'text-xs uppercase tracking-[0.35em]',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Description'),
                    React.createElement('input', {
                        key: 'input',
                        type: 'text',
                        value: description,
                        onChange: e => setDescription(e.target.value),
                        className: 'bg-transparent text-lg font-semibold focus:outline-none',
                        style: { color: '#2b1d14' }
                    })
                ])
            ]),
            React.createElement('div', {
                key: 'buttons',
                className: 'flex items-center gap-3'
            }, [
                React.createElement('button', {
                    key: 'cancel',
                    type: 'button',
                    className: 'rounded-full border px-4 py-2 text-sm transition',
                    style: { borderColor: 'rgba(92, 49, 30, 0.2)', color: 'rgba(43, 29, 20, 0.7)' },
                    onClick: onDismiss
                }, 'Cancel'),
                React.createElement('button', {
                    key: 'save',
                    type: 'button',
                    onClick: handleSave,
                    disabled: isSaving,
                    className: 'rounded-full px-6 py-2 text-sm font-semibold shadow-[0_8px_20px_rgba(92,49,30,0.25)] transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-60',
                    style: { backgroundColor: '#8e3c2c', color: '#fffdf9' }
                }, isSaving ? 'Saving...' : 'Save Profile')
            ])
        ]),
        React.createElement('div', {
            key: 'graph',
            className: 'relative flex-1 overflow-hidden flex',
            style: { backgroundColor: '#fffefb', color: '#2b1d14' },
            onClick: e => e.stopPropagation()
        }, [
                React.createElement('div', {
                    key: 'sidebar',
                    className: 'w-64 border-r p-6 flex flex-col gap-4',
                    style: { borderColor: 'rgba(92, 49, 30, 0.12)' }
                }, [
                    React.createElement('h3', {
                        key: 'title',
                        className: 'text-sm font-semibold uppercase tracking-[0.3em]',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Add Nodes'),
                    React.createElement('div', {
                        key: 'node-options',
                        className: 'flex flex-col gap-3'
                    }, [
                        React.createElement('div', {
                            key: 'special-rule',
                            className: 'rounded-xl border-2 border-dashed px-4 py-3 cursor-move transition hover:border-[#8e3c2c] hover:bg-[rgba(142,60,44,0.05)]',
                            style: { borderColor: 'rgba(92, 49, 30, 0.2)' }
                        }, [
                            React.createElement('p', {
                                key: 'label',
                                className: 'text-xs uppercase tracking-[0.25em]',
                                style: { color: 'rgba(43, 29, 20, 0.5)' }
                            }, 'Drag to Add'),
                            React.createElement('p', {
                                key: 'title',
                                className: 'text-sm font-semibold mt-1',
                                style: { color: '#2b1d14' }
                            }, 'Special Rule')
                        ])
                    ])
                ]),
                React.createElement('div', {
                    key: 'graph-container',
                    ref: containerRef,
                    className: 'relative flex-1 overflow-hidden',
                    onClick: e => e.stopPropagation()
                }, [
                    React.createElement('div', {
                        key: 'bg',
                        className: 'pointer-events-none absolute inset-0',
                        style: { background: 'radial-gradient(circle at top, rgba(201, 132, 84, 0.08), transparent 55%)' }
                    }),
                    React.createElement('div', {
                        key: 'grid-wrapper',
                        className: 'relative h-full w-full flex items-center justify-end pr-8'
                    },
                        React.createElement('div', {
                            key: 'grid',
                            className: 'relative grid h-full grid-cols-3 gap-12 p-8',
                            style: { width: '85%' }
                        }, [
                    React.createElement('div', {
                        key: 'left',
                        className: 'flex flex-col justify-around'
                    }, leftNodes.map(node =>
                        React.createElement('div', {
                            key: node.id,
                            className: 'flex justify-start'
                        },
                            React.createElement('div', {
                                className: 'w-44'
                            },
                                React.createElement(NodeCard, {
                                    title: node.label,
                                    subtitle: `Weight ${node.weight.toFixed(2)}`,
                                    accent: node.accent,
                                    active: activeEdge?.from === node.id,
                                    onClick: () => {
                                        const edge = edges.find(e => e.from === node.id && e.type === 'priority');
                                        const nodePos = nodePositions[node.id];
                                        const routerPos = nodePositions.router;
                                        if (edge && nodePos && routerPos) {
                                            const start = { x: nodePos.x, y: nodePos.y };
                                            const end = { x: routerPos.left, y: routerPos.y };
                                            handleEdgeClick(edge, start, end);
                                        }
                                    },
                                    nodeRef: el => leftRefs.current[node.id] = el
                                })
                            )
                        )
                    )),
                    React.createElement('div', {
                        key: 'center',
                        className: 'flex items-center justify-center'
                    },
                        React.createElement('div', {
                            className: 'w-44'
                        },
                            React.createElement(NodeCard, {
                                title: 'Restruct Router',
                                subtitle: 'Weighted orchestration',
                                accent: siteColors.router,
                                active: !drawerFamilyId,
                                onClick: () => setDrawerFamilyId(null),
                                nodeRef: centerRef
                            })
                        )
                    ),
                    React.createElement('div', {
                        key: 'right',
                        className: 'flex flex-col justify-around'
                    }, families.map(family =>
                        React.createElement('div', {
                            key: family.id,
                            className: 'flex justify-end'
                        },
                            React.createElement('div', {
                                className: 'w-44'
                            },
                                React.createElement(NodeCard, {
                                    title: family.label,
                                    subtitle: family.enabled ? 'Active' : 'Disabled',
                                    accent: family.accent,
                                    active: drawerFamilyId === family.id,
                                    onClick: () => openFamilyDrawer(family.id),
                                    nodeRef: el => rightRefs.current[family.id] = el
                                })
                            )
                        )
                    ))
                ])
                ),
                React.createElement('svg', {
                    key: 'svg',
                    className: 'pointer-events-none absolute inset-0',
                    width: '100%',
                    height: '100%'
                }, edges.map(edge => {
                    const router = nodePositions.router;
                    if (!router || !edge.visible) return null;

                    let start, end;

                    if (edge.type === 'priority') {
                        const leftNode = nodePositions[edge.from];
                        if (!leftNode) return null;
                        start = { x: leftNode.x, y: leftNode.y };
                        end = { x: router.left, y: router.y };
                    } else {
                        const rightNode = nodePositions[edge.to];
                        if (!rightNode) return null;
                        start = { x: router.right, y: router.y };
                        end = { x: rightNode.x, y: rightNode.y };
                    }

                    const curvature = edge.type === 'priority' ? 70 : 120;
                    const d = `M ${start.x} ${start.y} C ${start.x + curvature} ${start.y}, ${end.x - curvature} ${end.y}, ${end.x} ${end.y}`;
                    const strokeColor = hoveredEdgeId === edge.id || activeEdge?.id === edge.id ? edge.accent : siteColors.edgeIdle;
                    const opacity = edge.enabled === false ? 0.25 : 1;

                    return React.createElement('path', {
                        key: edge.id,
                        d,
                        fill: 'none',
                        stroke: strokeColor,
                        strokeWidth: hoveredEdgeId === edge.id || activeEdge?.id === edge.id ? 2.5 : 1.5,
                        strokeDasharray: '6 6',
                        strokeLinecap: 'round',
                        className: 'cursor-pointer transition-all',
                        style: { opacity, pointerEvents: 'all' },
                        onClick: e => {
                            e.stopPropagation();
                            handleEdgeClick(edge, start, end);
                        },
                        onMouseEnter: () => setHoveredEdgeId(edge.id),
                        onMouseLeave: () => setHoveredEdgeId(null)
                    });
                })),
                React.createElement(EdgePopover, {
                    key: 'popover',
                    edge: activeEdge,
                    position: edgePosition,
                    onClose: () => setActiveEdge(null),
                    onWeightUpdate: updateEdgeWeight,
                    onToggleConnection: updateEdgeEnabled
                }),
                React.createElement(FamilyDrawer, {
                    key: 'drawer',
                    family: drawerFamily,
                    onClose: closeFamilyDrawer,
                    onToggle: updateFamilyToggle,
                    onBlacklist: updateBlacklist
                }),
                error && React.createElement('div', {
                    key: 'error',
                    className: 'absolute bottom-6 left-6 rounded-2xl border px-4 py-3',
                    style: { borderColor: 'rgba(142, 60, 44, 0.3)', backgroundColor: 'rgba(142, 60, 44, 0.1)', color: '#8e3c2c' }
                }, error),
                success && React.createElement('div', {
                    key: 'success',
                    className: 'absolute bottom-6 left-6 rounded-2xl border px-4 py-3',
                    style: { borderColor: 'rgba(181, 103, 71, 0.3)', backgroundColor: 'rgba(181, 103, 71, 0.1)', color: '#b56747' }
                }, success)
            ])
        ])
    ]);
}

const rootElement = document.getElementById('profileBuilderReactRoot');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(React.createElement(ProfileBuilderShell));
}
