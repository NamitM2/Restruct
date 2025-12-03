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
    maxCostPerCall: 300,
    maxOutputTokens: 10000,
    maxLatency: 0.20,
    maxRateLimits: 0,
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
    return React.createElement('div', {
        className: 'flex items-center justify-between gap-3'
    }, [
        React.createElement('span', {
            key: 'label',
            className: 'text-sm flex-1',
            style: { color: '#2b1d14' }
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
            style: { color: 'rgba(43, 29, 20, 0.6)' }
        }, `Weight ${value.toFixed(2)}`)
    ]);
};

// Number input component
const NumberInput = ({ label, value, onChange, step = 1 }) => {
    return React.createElement('div', {
        className: 'flex items-center justify-between gap-3'
    }, [
        React.createElement('span', {
            key: 'label',
            className: 'text-sm flex-1',
            style: { color: '#2b1d14' }
        }, label),
        React.createElement('input', {
            key: 'input',
            type: 'number',
            value: value,
            step: step,
            onChange: e => onChange(parseFloat(e.target.value) || 0),
            className: 'w-20 px-2 py-1 text-sm text-right rounded-lg border bg-white',
            style: { borderColor: 'rgba(92, 49, 30, 0.15)', color: '#2b1d14' }
        })
    ]);
};

// Toggle switch component
const Toggle = ({ label, icon, enabled, onChange }) => {
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
                style: { backgroundColor: 'rgba(92, 49, 30, 0.1)', color: '#5b2a1a' }
            }, icon),
            React.createElement('span', {
                key: 'text',
                className: 'text-sm',
                style: { color: '#2b1d14' }
            }, label)
        ]),
        React.createElement('button', {
            key: 'toggle',
            type: 'button',
            onClick: () => onChange(!enabled),
            className: 'w-10 h-5 rounded-full transition-colors relative',
            style: { backgroundColor: enabled ? '#b56747' : 'rgba(92, 49, 30, 0.15)' }
        }, React.createElement('span', {
            className: 'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            style: { left: enabled ? '22px' : '2px' }
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
const MiniNodeCard = ({ title, subtitle, accent, active, onClick, nodeRef, hasToggle, enabled, onToggle, isLocal }) => {
    return React.createElement('div', {
        ref: nodeRef,
        className: `relative rounded-xl border px-3 py-2 transition-all cursor-pointer ${active ? 'border-[#8e3c2c] shadow-lg' : isLocal ? 'border-[#8e3c2c]' : 'border-[rgba(92,49,30,0.12)]'}`,
        style: { backgroundColor: isLocal ? '#8e3c2c' : 'var(--bg-elevated)', minWidth: '120px' },
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
                    className: 'text-sm font-semibold',
                    style: { color: isLocal ? '#fffcf8' : '#2b1d14' }
                }, title),
                subtitle && React.createElement('p', {
                    key: 'subtitle',
                    className: 'text-xs',
                    style: { color: isLocal ? 'rgba(255, 252, 248, 0.8)' : 'rgba(43, 29, 20, 0.6)' }
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

// Toast notification component with particles
const Toast = ({ message, type, onClose }) => {
    const [particles, setParticles] = useState([]);
    const toastRef = useRef(null);

    useEffect(() => {
        if (type === 'success') {
            // Generate particles for success
            const newParticles = [];
            for (let i = 0; i < 20; i++) {
                newParticles.push({
                    id: i,
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    size: Math.random() * 4 + 2,
                    speedX: (Math.random() - 0.5) * 3,
                    speedY: (Math.random() - 0.5) * 3 - 1,
                    opacity: 1,
                    color: ['#dbc4a0', '#c98454', '#b56747'][Math.floor(Math.random() * 3)]
                });
            }
            setParticles(newParticles);
        }

        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [type, onClose]);

    useEffect(() => {
        if (particles.length === 0) return;

        const interval = setInterval(() => {
            setParticles(prev => prev.map(p => ({
                ...p,
                x: p.x + p.speedX,
                y: p.y + p.speedY,
                opacity: p.opacity - 0.02
            })).filter(p => p.opacity > 0));
        }, 30);

        return () => clearInterval(interval);
    }, [particles.length]);

    const bgColor = type === 'success'
        ? 'linear-gradient(135deg, rgba(92, 49, 30, 0.97), rgba(94, 52, 42, 0.97))'
        : type === 'error'
        ? 'linear-gradient(135deg, rgba(139, 79, 63, 0.97), rgba(94, 52, 42, 0.97))'
        : 'linear-gradient(135deg, rgba(92, 49, 30, 0.95), rgba(139, 79, 63, 0.95))';

    return React.createElement('div', {
        ref: toastRef,
        className: 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto',
        style: { animation: 'toastSlideUp 0.3s ease-out' }
    }, [
        // Particles container
        type === 'success' && React.createElement('div', {
            key: 'particles',
            className: 'absolute inset-0 overflow-visible pointer-events-none',
            style: { width: '300px', height: '60px', left: '-50px', top: '-20px' }
        }, particles.map(p => React.createElement('div', {
            key: p.id,
            className: 'absolute rounded-full',
            style: {
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`
            }
        }))),
        // Toast body
        React.createElement('div', {
            key: 'body',
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
        ])
    ]);
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

    const config = useMemo(() => ({
        gridSize: 35,
        gravityStrength: 18,
        influenceRadius: 100,
        dampening: 0.95,
        returnSpeed: 0.05,
        lineColor: 'rgba(92, 49, 30, 0.15)',
        maxDisplacement: 20
    }), []);

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
            updatePoints();
            drawMesh();
            rafRef.current = requestAnimationFrame(animate);
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
        if (parentElement) {
            parentElement.addEventListener('mousemove', handleMouseMove);
            parentElement.addEventListener('mouseleave', handleMouseLeave);
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

    return React.createElement('div', {
        ref: containerRef,
        className: 'absolute inset-0 overflow-hidden pointer-events-none',
        style: { zIndex: 0 }
    }, React.createElement('canvas', { ref: canvasRef, className: 'absolute inset-0 w-full h-full' }));
};

function ProfileBuilder({ onDismiss, initialOptions }) {
    const [leftPanelMode, setLeftPanelMode] = useState('settings'); // 'settings' or 'rules'
    const [profileName, setProfileName] = useState('');
    const [description, setDescription] = useState('');
    const [weights, setWeights] = useState(defaultWeights);
    const [hardLimits, setHardLimits] = useState(defaultHardLimits);
    const [providers, setProviders] = useState(
        providerPresets.map(p => ({ ...p, enabled: p.id === 'local' ? false : true }))
    );
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

    const containerRef = useRef(null);
    const leftRefs = useRef({});
    const centerRef = useRef(null);
    const rightRefs = useRef({});
    const [nodePositions, setNodePositions] = useState({});

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

    const handleSave = async () => {
        if (!profileName.trim()) {
            showToast('Please enter a profile name', 'warning');
            return;
        }
        setIsSaving(true);

        const graphState = { weights, hardLimits, providers, rules };
        const payload = { name: profileName, description, graph_state: graphState };

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${window.API_URL}/profiles`, {
                method: 'POST',
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
            window.dispatchEvent(new CustomEvent('routing-profile:created', { detail: { profile: saved.profile } }));
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

    // Calculate node positions for graph edges
    useEffect(() => {
        const calculatePositions = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const positions = {};

            weights.forEach(node => {
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

            providers.forEach(provider => {
                const el = rightRefs.current[provider.id];
                if (el) {
                    const rect = el.getBoundingClientRect();
                    positions[provider.id] = {
                        x: rect.left - containerRect.left,
                        y: rect.top + rect.height / 2 - containerRect.top
                    };
                }
            });

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
    const confidenceScore = (weights.reduce((sum, w) => sum + w.weight, 0) / weights.length * 100).toFixed(1);

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
                style: { color: '#5b2a1a' }
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
                        style: { color: leftPanelMode === 'settings' ? '#5b2a1a' : 'rgba(43, 29, 20, 0.6)' }
                    }, 'Settings'),
                    React.createElement('button', {
                        key: 'rules',
                        type: 'button',
                        onClick: () => setLeftPanelMode('rules'),
                        className: `flex-1 px-3 py-2 text-sm font-medium rounded-lg transition ${leftPanelMode === 'rules' ? 'bg-white shadow-sm' : ''}`,
                        style: { color: leftPanelMode === 'rules' ? '#5b2a1a' : 'rgba(43, 29, 20, 0.6)' }
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
                        React.createElement(NumberInput, { key: 'maxCost', label: 'max cost per call', value: hardLimits.maxCostPerCall, onChange: v => updateHardLimit('maxCostPerCall', v) }),
                        React.createElement(NumberInput, { key: 'maxTokens', label: 'max output tokens', value: hardLimits.maxOutputTokens, onChange: v => updateHardLimit('maxOutputTokens', v) }),
                        React.createElement(NumberInput, { key: 'maxLatency', label: 'max latency (ms)', value: hardLimits.maxLatency, onChange: v => updateHardLimit('maxLatency', v), step: 0.01 }),
                        React.createElement(NumberInput, { key: 'rateLimit', label: 'max rate limits', value: hardLimits.maxRateLimits, onChange: v => updateHardLimit('maxRateLimits', v) }),
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
                            style: { borderColor: 'rgba(92, 49, 30, 0.15)', backgroundColor: 'var(--bg-elevated)', color: '#2b1d14' }
                        }),
                        React.createElement('button', {
                            key: 'send',
                            type: 'button',
                            className: 'w-11 h-11 rounded-xl flex items-center justify-center transition hover:opacity-90',
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
                        className: 'absolute inset-0 flex items-center justify-center p-8'
                    }, [
                        // Left nodes (weights)
                        React.createElement('div', {
                            key: 'left',
                            className: 'flex flex-col gap-4 mr-12'
                        }, weights.map(w => React.createElement(MiniNodeCard, {
                            key: w.id,
                            title: w.label,
                            subtitle: null,
                            accent: siteColors.quality,
                            nodeRef: el => leftRefs.current[w.id] = el
                        }))),
                        // Center router
                        React.createElement('div', {
                            key: 'center',
                            className: 'mx-8'
                        }, React.createElement(MiniNodeCard, {
                            title: 'Restruct Router',
                            subtitle: 'Weighted orchestration',
                            accent: siteColors.router,
                            active: true,
                            nodeRef: centerRef
                        })),
                        // Right nodes (providers)
                        React.createElement('div', {
                            key: 'right',
                            className: 'flex flex-col gap-3 ml-12'
                        }, providers.map(p => React.createElement(MiniNodeCard, {
                            key: p.id,
                            title: p.label,
                            subtitle: p.isLocal
                                ? (p.enabled ? 'Local • Active' : 'Local • Disabled')
                                : (p.enabled ? 'Active' : 'Disabled'),
                            accent: p.color || siteColors.cost,
                            hasToggle: true,
                            enabled: p.enabled,
                            onToggle: () => toggleProvider(p.id),
                            nodeRef: el => rightRefs.current[p.id] = el,
                            isLocal: p.isLocal
                        })))
                    ]),
                    // SVG edges
                    React.createElement('svg', {
                        key: 'svg',
                        className: 'pointer-events-none absolute inset-0',
                        width: '100%',
                        height: '100%'
                    }, (() => {
                        const router = nodePositions.router;
                        if (!router) return null;
                        const edges = [];

                        // Left to router edges
                        weights.forEach(w => {
                            const leftNode = nodePositions[w.id];
                            if (!leftNode) return;
                            const d = `M ${leftNode.x} ${leftNode.y} C ${leftNode.x + 60} ${leftNode.y}, ${router.left - 60} ${router.y}, ${router.left} ${router.y}`;
                            edges.push(React.createElement('path', {
                                key: `left-${w.id}`,
                                d,
                                fill: 'none',
                                stroke: siteColors.edgeIdle,
                                strokeWidth: 1.5,
                                strokeDasharray: '6 6'
                            }));
                        });

                        // Router to right edges
                        providers.forEach(p => {
                            const rightNode = nodePositions[p.id];
                            if (!rightNode) return;
                            const d = `M ${router.right} ${router.y} C ${router.right + 80} ${router.y}, ${rightNode.x - 80} ${rightNode.y}, ${rightNode.x} ${rightNode.y}`;
                            edges.push(React.createElement('path', {
                                key: `right-${p.id}`,
                                d,
                                fill: 'none',
                                stroke: p.enabled ? siteColors.edgeIdle : 'rgba(92, 49, 30, 0.1)',
                                strokeWidth: 1.5,
                                strokeDasharray: '6 6'
                            }));
                        });

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
                    key: 'providers-section',
                    className: 'mb-4'
                }, [
                    React.createElement('p', {
                        key: 'label',
                        className: 'text-xs mb-2',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Active Providers'),
                    React.createElement('div', {
                        key: 'list',
                        className: 'text-sm',
                        style: { color: '#2b1d14' }
                    }, activeProviders.map(p => React.createElement('div', {
                        key: p.id,
                        className: 'mb-1'
                    }, p.label)))
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

                React.createElement('div', {
                    key: 'limits-section',
                    className: 'mb-4'
                }, [
                    React.createElement('p', {
                        key: 'label',
                        className: 'text-xs mb-2',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Hard Limit'),
                    React.createElement('div', {
                        key: 'values',
                        className: 'text-xs space-y-1',
                        style: { color: '#2b1d14' }
                    }, [
                        React.createElement('div', { key: 'max', className: 'flex justify-between' }, [
                            React.createElement('span', { key: 'l' }, 'Max Limit'),
                            React.createElement('span', { key: 'v' }, hardLimits.maxCostPerCall)
                        ]),
                        React.createElement('div', { key: 'tokens', className: 'flex justify-between' }, [
                            React.createElement('span', { key: 'l' }, 'Max Limit'),
                            React.createElement('span', { key: 'v' }, hardLimits.maxOutputTokens)
                        ])
                    ])
                ]),

                React.createElement('div', {
                    key: 'fallback-section',
                    className: 'mb-4'
                }, [
                    React.createElement('p', {
                        key: 'label',
                        className: 'text-xs mb-2',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Fallback Chain'),
                    React.createElement('div', {
                        key: 'chain',
                        className: 'text-xs flex items-center gap-1 flex-wrap',
                        style: { color: '#2b1d14' }
                    }, activeProviders.slice(0, 4).map((p, i) => [
                        React.createElement('span', { key: p.id }, p.label.split(' ')[0]),
                        i < Math.min(activeProviders.length - 1, 3) && React.createElement('span', { key: `arrow-${i}`, style: { color: 'rgba(43, 29, 20, 0.3)' } }, '→')
                    ]).flat().filter(Boolean))
                ]),

                React.createElement('div', {
                    key: 'confidence',
                    className: 'flex justify-between items-center mb-4'
                }, [
                    React.createElement('span', {
                        key: 'label',
                        className: 'text-xs',
                        style: { color: 'rgba(43, 29, 20, 0.5)' }
                    }, 'Confidence Score'),
                    React.createElement('span', {
                        key: 'value',
                        className: 'text-sm font-semibold',
                        style: { color: '#b56747' }
                    }, confidenceScore)
                ]),

                testPrompt && React.createElement('div', {
                    key: 'explanation',
                    className: 'p-3 rounded-lg text-xs',
                    style: { backgroundColor: 'rgba(92, 49, 30, 0.04)', color: 'rgba(43, 29, 20, 0.7)' }
                }, [
                    React.createElement('p', {
                        key: 'title',
                        className: 'font-semibold mb-1',
                        style: { color: '#2b1d14' }
                    }, 'Routing explanation'),
                    `Based on your prompt "${testPrompt.slice(0, 30)}...", the router will prioritize ${activeProviders[0]?.label || 'available providers'} based on current weight configuration.`
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
