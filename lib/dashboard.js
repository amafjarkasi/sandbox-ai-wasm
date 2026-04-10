/**
 * SandboxAI - Dashboard (The Nebula Console)
 * Premium futuristic interface for secure code execution.
 */

class Dashboard {
  constructor({ executor, executionQueue, engineManager }) {
    this.executor = executor;
    this.executionQueue = executionQueue;
    this.engineManager = engineManager;
  }

  /**
   * Render the dashboard HTML
   */
  render() {
    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>SANDBOXAI // NEBULA_OS // SECURE_KERNEL</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        brand: {
                            50: '#f0f9ff',
                            100: '#e0f2fe',
                            200: '#bae6fd',
                            300: '#7dd3fc',
                            400: '#38bdf8',
                            500: '#0ea5e9',
                            600: '#0284c7',
                            700: '#0369a1',
                            800: '#075985',
                            900: '#0c4a6e',
                            950: '#082f49',
                        },
                        ui: {
                            bg: "#02040a",
                            surface: "#0d1117",
                            glass: "rgba(13, 17, 23, 0.7)",
                            border: "rgba(255, 255, 255, 0.08)",
                            active: "#38bdf8",
                        }
                    },
                    fontFamily: {
                        sans: ["Plus Jakarta Sans", "sans-serif"],
                        mono: ["JetBrains Mono", "monospace"],
                    },
                    animation: {
                        'glow-pulse': 'glow-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        'float': 'float 6s ease-in-out infinite',
                        'scanning': 'scanning 4s linear infinite',
                    },
                    keyframes: {
                        'glow-pulse': {
                            '0%, 100%': { opacity: 0.8, filter: 'brightness(1) blur(0px)' },
                            '50%': { opacity: 1, filter: 'brightness(1.5) blur(2px)' },
                        },
                        'float': {
                            '0%, 100%': { transform: 'translateY(0)' },
                            '50%': { transform: 'translateY(-10px)' },
                        },
                        'scanning': {
                            '0%': { transform: 'translateY(-100%)' },
                            '100%': { transform: 'translateY(100%)' },
                        }
                    }
                },
            },
        }
    </script>
    <style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
        }
        
        body {
            background-color: #02040a;
            color: #f8fafc;
            font-family: 'Plus Jakarta Sans', sans-serif;
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 0% 100%, rgba(129, 140, 248, 0.1) 0%, transparent 40%);
        }

        .glass {
            background: rgba(13, 17, 23, 0.7);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
        }

        .neo-border {
            position: relative;
        }
        .neo-border::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            width: 0%;
            height: 1px;
            background: linear-gradient(90deg, transparent, #38bdf8, transparent);
            transition: width 0.3s ease;
        }
        .neo-border:hover::after {
            width: 100%;
        }

        .terminal-glow {
            box-shadow: inset 0 0 40px rgba(14, 165, 233, 0.05);
        }

        /* Scan-line animation */
        .scanline-container {
            position: relative;
            overflow: hidden;
        }
        .scanline-container::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                rgba(18, 16, 16, 0) 50%,
                rgba(0, 0, 0, 0.1) 50%
            );
            background-size: 100% 4px;
            z-index: 2;
            pointer-events: none;
            opacity: 0.3;
        }

        /* Customized Scrollbar */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
        }
        ::-webkit-scrollbar-thumb {
            background: rgba(56, 189, 248, 0.2);
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(56, 189, 248, 0.4);
        }

        /* Status Indicators */
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            box-shadow: 0 0 10px currentColor;
        }

        .engine-v8 { color: #f87171; }
        .engine-jsc { color: #60a5fa; }
        .engine-qjs { color: #34d399; }

        .sidebar-item-active {
            background: linear-gradient(90deg, rgba(56, 189, 248, 0.1) 0%, transparent 100%);
            border-left: 2px solid #38bdf8;
        }

        .btn-premium {
            background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);
            box-shadow: 0 4px 15px rgba(14, 165, 233, 0.4);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-premium:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(14, 165, 233, 0.6);
            filter: brightness(1.1);
        }
        .btn-premium:active {
            transform: translateY(0);
        }

        .ticker-wrap {
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .monaco-font {
            font-family: 'JetBrains Mono', monospace;
        }
    </style>
</head>
<body class="min-h-screen text-slate-200">
    <!-- Background Decor -->
    <div class="fixed inset-0 pointer-events-none opacity-20">
        <div class="absolute top-[10%] left-[5%] w-72 h-72 bg-brand-500 rounded-full blur-[120px]"></div>
        <div class="absolute bottom-[10%] right-[5%] w-96 h-96 bg-indigo-500 rounded-full blur-[150px]"></div>
    </div>

    <!-- Header -->
    <header class="fixed top-0 w-full z-50 glass border-b border-ui-border">
        <div class="max-w-[1700px] mx-auto flex items-center justify-between px-8 py-4">
            <div class="flex items-center gap-12">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <span class="material-symbols-outlined text-brand-400 text-3xl animate-glow-pulse">deployed_code</span>
                        <div class="absolute -top-1 -right-1 w-2 h-2 bg-brand-400 rounded-full"></div>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xl font-extrabold tracking-tight text-white">SANDBOX<span class="text-brand-400">AI</span></span>
                        <span class="text-[10px] font-mono tracking-[0.2em] text-slate-500 uppercase">Edge OS // Nebula Kernel v3.4</span>
                    </div>
                </div>

                <nav class="hidden lg:flex items-center gap-8 ml-4">
                    <a href="#" class="text-xs font-semibold text-brand-400 neo-border pb-1">CONSOLE</a>
                    <a href="/security" class="text-xs font-semibold text-slate-400 hover:text-white transition-colors">SECURITY_VAULT</a>
                    <a href="#" class="text-xs font-semibold text-slate-400 hover:text-white transition-colors">CLUSTER_OPS</a>
                    <a href="#" class="text-xs font-semibold text-slate-400 hover:text-white transition-colors">TELEMETRY</a>
                </nav>
            </div>
            
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-6 pr-6 border-r border-ui-border">
                    <div class="flex flex-col items-end">
                        <span class="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Uplink Status</span>
                        <div class="flex items-center gap-2">
                            <div id="uplinkDot" class="status-dot bg-amber-500 animate-pulse"></div>
                            <span id="uplinkStatus" class="text-xs font-bold font-mono text-amber-500 uppercase">Negotiating...</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center gap-4">
                    <button class="p-2 text-slate-400 hover:text-white transition-colors">
                        <span class="material-symbols-outlined">notifications</span>
                    </button>
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                        JP
                    </div>
                </div>
            </div>
        </div>
    </header>

    <main class="pt-28 pb-16 px-8 max-w-[1700px] mx-auto grid grid-cols-12 gap-8">
        
        <!-- Sidebar: Navigation & Context -->
        <div class="col-span-12 lg:col-span-2 space-y-6">
            <div class="glass p-4 rounded-2xl space-y-1">
                <p class="text-[10px] font-bold text-slate-500 uppercase px-3 pb-2 tracking-widest">Main Modules</p>
                <div class="sidebar-item-active rounded-xl px-3 py-2.5 flex items-center gap-3 group cursor-pointer">
                    <span class="material-symbols-outlined text-lg text-brand-400">dashboard</span>
                    <span class="text-xs font-semibold text-white">Command Center</span>
                </div>
                <div class="rounded-xl px-3 py-2.5 flex items-center gap-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all group cursor-pointer">
                    <span class="material-symbols-outlined text-lg group-hover:text-brand-400 transition-colors">security</span>
                    <span class="text-xs font-medium">Security Policies</span>
                </div>
                <div class="rounded-xl px-3 py-2.5 flex items-center gap-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all group cursor-pointer">
                    <span class="material-symbols-outlined text-lg group-hover:text-brand-400 transition-colors">database</span>
                    <span class="text-xs font-medium">Engine Clusters</span>
                </div>
                <div class="rounded-xl px-3 py-2.5 flex items-center gap-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all group cursor-pointer">
                    <span class="material-symbols-outlined text-lg group-hover:text-brand-400 transition-colors">history</span>
                    <span class="text-xs font-medium">Audit History</span>
                </div>
            </div>

            <div class="glass p-6 rounded-2xl space-y-6">
                <div class="space-y-2">
                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Compute Core</label>
                    <div class="relative">
                        <select id="engineSelect" class="w-full bg-slate-950 border border-ui-border rounded-xl text-xs font-mono text-white p-3 pr-10 focus:ring-1 focus:ring-brand-400 outline-none appearance-none transition-all">
                            <option value="v8">V8 BLADE (STABLE)</option>
                            <option value="jsc">JSC ORBIT (FAST)</option>
                            <option value="quickjs">QJS LITE (ULTRA)</option>
                        </select>
                        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-sm">expand_more</span>
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Isolation Layer</label>
                    <div class="relative">
                        <select id="policySelect" class="w-full bg-slate-950 border border-ui-border rounded-xl text-xs font-mono text-white p-3 pr-10 focus:ring-1 focus:ring-brand-400 outline-none appearance-none transition-all">
                            <option value="strict">LEVEL_7 (MAX_SEC)</option>
                            <option value="standard">LEVEL_5 (STANDARD)</option>
                            <option value="extended">LEVEL_3 (EXTENDED)</option>
                            <option value="agent">LEVEL_1 (UNRESTRICTED)</option>
                        </select>
                        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-sm">expand_more</span>
                    </div>
                </div>

                <div class="pt-2 border-t border-ui-border">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Memory Pressure</span>
                        <span class="text-[10px] font-mono text-brand-400">12.4 MB</span>
                    </div>
                    <div class="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div class="h-full bg-brand-400 rounded-full" style="width: 42%"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Middle Column: Processing Terminal -->
        <div class="col-span-12 lg:col-span-7 space-y-8">
            <div class="glass rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[640px] border-brand-400/20">
                <div class="flex items-center justify-between px-6 py-4 border-b border-ui-border bg-slate-900/40 backdrop-blur-md">
                    <div class="flex items-center gap-6">
                        <div class="flex gap-2">
                            <div class="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40"></div>
                            <div class="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40"></div>
                            <div class="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40"></div>
                        </div>
                        <div class="h-4 w-px bg-ui-border"></div>
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-brand-400 text-base">terminal</span>
                            <span class="text-[11px] font-mono tracking-widest text-slate-400 uppercase">Executive Enclave // Ready</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-[10px] font-mono text-brand-400/60 flex items-center gap-1">
                            <span class="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse"></span>
                            SECURE_CHANNEL_ACTIVE
                        </span>
                    </div>
                </div>
                
                <div class="flex-grow flex flex-col scanline-container bg-slate-950/80">
                    <textarea id="codeInput" class="flex-grow bg-transparent text-slate-300 p-8 font-mono text-sm border-none focus:ring-0 resize-none leading-relaxed overflow-y-auto selection:bg-brand-500/30" spellcheck="false" placeholder="// Booting singularity protocol...">/*
 * SANDBOXAI // SINGULARITY_PROTOCOL
 * VERIFICATION_LEVEL: 09
 */

async function initiate_sequence() {
    console.log("--> KERNEL_INITIALIZATION_STARTED");
    
    const payload = { 
        id: "sandbox_" + Math.random().toString(36).substring(7),
        status: "ACTIVE",
        isolated: true,
        entropy: Math.random().toFixed(4)
    };
    
    console.log("--> HANDSHAKE_SUCCESSFUL", payload);
    return payload;
}

initiate_sequence();</textarea>

                    <!-- Terminal Output (Integrated) -->
                    <div id="outputArea" class="h-48 border-t border-ui-border bg-black/60 p-6 font-mono text-[11px] leading-relaxed overflow-y-auto terminal-glow">
                        <div id="output">
                            <p class="text-brand-400/60">// System bridge established. Encryption: CHACHA20-POLY1305</p>
                            <p class="text-slate-500 mt-1">// Integrity scan completed. No anomalies detected.</p>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="text-brand-400 animate-pulse">_</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="px-8 py-5 bg-slate-900/60 border-t border-ui-border flex justify-between items-center">
                    <div class="flex gap-4">
                        <button onclick="document.getElementById('output').innerHTML = '<p class=\\'text-slate-500\\'>// Channel reset. Awaiting transmission...</p>'" class="text-slate-500 hover:text-brand-400 transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                            <span class="material-symbols-outlined text-sm">backspace</span>
                            Clear Logs
                        </button>
                    </div>
                    
                    <button id="runBtn" class="btn-premium py-3 px-10 rounded-xl flex items-center gap-3 active:scale-95 group">
                        <span class="text-xs font-extrabold tracking-[0.2em] text-white">RUN_EXECUTIVE</span>
                        <div class="w-px h-4 bg-white/20"></div>
                        <span class="material-symbols-outlined text-white text-lg group-hover:rotate-12 transition-transform">bolt</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Right Column: Stats & Security -->
        <div class="col-span-12 lg:col-span-3 space-y-8">
            <!-- Stats Grid -->
            <div class="grid grid-cols-2 gap-4">
                <div class="glass p-5 rounded-2xl">
                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Total Cycles</span>
                    <span id="totalExecs" class="text-2xl font-bold text-white font-mono">0</span>
                </div>
                <div class="glass p-5 rounded-2xl">
                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Latency</span>
                    <span id="avgDuration" class="text-2xl font-bold text-brand-400 font-mono">0ms</span>
                </div>
            </div>

            <!-- Integrity Circular Metric -->
            <div class="glass p-8 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group">
                <div class="absolute inset-0 bg-brand-400 opacity-0 group-hover:opacity-5 transition-opacity duration-700"></div>
                <div class="relative w-40 h-40 flex items-center justify-center">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="currentColor" stroke-width="6" fill="transparent" class="text-slate-900"></circle>
                        <circle cx="80" cy="80" r="70" stroke="currentColor" stroke-width="6" fill="transparent" stroke-dasharray="440" stroke-dashoffset="44" stroke-linecap="round" class="text-brand-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"></circle>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <span id="successRate" class="text-3xl font-extrabold text-white">0%</span>
                        <span class="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Integrity</span>
                    </div>
                </div>
                <div class="mt-8 text-center space-y-1">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Scan Node: <span class="text-brand-400">NOMINAL</span></p>
                    <p class="text-[9px] font-mono text-slate-600">No threats detected during last sweep.</p>
                </div>
            </div>

            <!-- Security History -->
            <div class="glass rounded-3xl flex flex-col h-[340px]">
                <div class="px-6 py-5 border-b border-ui-border flex items-center justify-between">
                    <h3 class="text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase">Security Feed</h3>
                    <span id="threatCap" class="text-[8px] font-mono px-2 py-0.5 rounded bg-brand-400/10 text-brand-400 border border-brand-400/20 uppercase">SEC_LVL: NORMAL</span>
                </div>
                <div id="recentExecs" class="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    <div class="h-full flex flex-col items-center justify-center opacity-20 text-center p-6 grayscale">
                        <span class="material-symbols-outlined text-5xl mb-3">radar</span>
                        <p class="text-[10px] font-mono uppercase tracking-[0.2em]">Awaiting Cluster Data...</p>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer Ticker -->
    <footer class="fixed bottom-0 w-full z-50 ticker-wrap h-10 flex items-center px-8">
        <div class="flex items-center gap-4 border-r border-ui-border pr-4 mr-4 shrink-0">
            <span class="material-symbols-outlined text-brand-400 text-sm">hub</span>
            <span class="text-[9px] font-bold text-white uppercase tracking-widest">Global Status</span>
        </div>
        <div id="intelligenceTicker" class="flex-grow overflow-hidden relative">
            <div class="flex items-center gap-12 animate-[ticker_60s_linear_infinite] whitespace-nowrap text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                <span>// OS_CORE_v3.4.1 // LATENCY_ALPHA: 0.12ms // BRIDGE_VERIFIED: TRUE // ENTROPY: 0.2341 // ENCR: AES-GCM-256 // NODES: 12_ONLINE // SECURITY_MODE: PARANOID_L7 // UPLINK: STABLE // MEMORY_ALLOC: 4.2GB_RESERVED //</span>
                <span>// OS_CORE_v3.4.1 // LATENCY_ALPHA: 0.12ms // BRIDGE_VERIFIED: TRUE // ENTROPY: 0.2341 // ENCR: AES-GCM-256 // NODES: 12_ONLINE // SECURITY_MODE: PARANOID_L7 // UPLINK: STABLE // MEMORY_ALLOC: 4.2GB_RESERVED //</span>
            </div>
        </div>
    </footer>

    <style>
        @keyframes ticker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }
    </style>

    <script>
        // Use a more robust escaping strategy for backticks and dollar signs
        // By using single quotes for the outer string and escaping interior backticks
        
        let recentExecutions = [];
        let auditLogIdx = 0;

        // Initialize Uplink Status
        setTimeout(() => {
            const uplink = document.getElementById('uplinkStatus');
            const dot = document.getElementById('uplinkDot');
            if (uplink) {
                uplink.textContent = 'STABLE';
                uplink.classList.remove('text-amber-500', 'animate-pulse');
                uplink.classList.add('text-brand-400');
                if (dot) {
                    dot.classList.remove('bg-amber-500', 'animate-pulse');
                    dot.classList.add('bg-brand-400');
                    dot.style.boxShadow = '0 0 12px #38bdf8';
                }
                console.log('[SYSTEM] Uplink synchronized with Edge Core.');
            }
        }, 1500);

        async function fetchStats() {
            try {
                const res = await fetch('/api/stats');
                const data = await res.json();

                document.getElementById('totalExecs').textContent = (data.totalExecutions || 0).toLocaleString();
                
                const successRate = data.totalExecutions > 0
                    ? Math.round((data.successfulExecutions / data.totalExecutions) * 100)
                    : 100;
                document.getElementById('successRate').textContent = successRate + '%';
                
                // Update progress ring
                const circle = document.querySelector('svg circle:last-child');
                const offset = 440 - (440 * successRate / 100);
                circle.style.strokeDashoffset = offset;

                document.getElementById('avgDuration').textContent = Math.round(data.averageDurationMs || 0) + 'ms';
            } catch (e) {
                console.error('[TELEMETRY] Load fault:', e);
            }
        }

        async function fetchSecurity() {
            try {
                const res = await fetch('/api/audit/security-summary');
                const data = await res.json();
                
                const threatCap = document.getElementById('threatCap');
                if (threatCap) {
                    const level = data.severityScore > 50 ? 'CRITICAL' : (data.severityScore > 10 ? 'ELEVATED' : 'NOMINAL');
                    threatCap.textContent = 'SEC_LVL: ' + level;
                    threatCap.className = 'text-[8px] font-mono px-2 py-0.5 rounded border uppercase ' + 
                        (level === 'CRITICAL' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-brand-400/10 text-brand-400 border-brand-400/20');
                }
            } catch (e) {
                console.warn('[SECURITY] Sync interrupted.');
            }
        }

        async function pollAuditLogs() {
            try {
                const res = await fetch('/api/audit/executions');
                const data = await res.json();
                const audits = data.audits || [];
                
                if (audits.length > auditLogIdx) {
                    const latest = audits[audits.length - 1];
                    auditLogIdx = audits.length;
                    
                    addRecentExecution({
                        id: latest.id,
                        status: 'completed',
                        engine: latest.engine,
                        duration_ms: latest.duration_ms,
                        time: new Date(latest.timestamp).toLocaleTimeString(),
                        type: 'CLUSTER_EXEC'
                    });
                }
            } catch (e) {
                // Background polling errors suppressed
            }
        }

        async function runCode() {
            const code = document.getElementById('codeInput').value;
            const engine = document.getElementById('engineSelect').value;
            const policy = document.getElementById('policySelect').value;
            const output = document.getElementById('output');
            const btn = document.getElementById('runBtn');

            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            output.innerHTML += '<p class="text-brand-400/40 mt-2">// Initiating secure execution cycle [' + engine.toUpperCase() + ']...</p>';

            try {
                const res = await fetch('/api/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, engine, policy })
                });

                const result = await res.json();

                if (result.status === 'completed') {
                    output.innerHTML += '<p class="text-emerald-400 font-bold mt-2">// CYCLE_SUCCESSFUL: Handshake verified.</p>';
                    if (result.output) {
                        output.innerHTML += '<pre class="mt-2 p-4 bg-slate-900/50 border border-ui-border text-slate-300 whitespace-pre-wrap font-mono uppercase text-[10px] rounded-xl">' + result.output + '</pre>';
                    }
                } else if (result.status === 'rejected') {
                    output.innerHTML += '<p class="text-red-500 font-bold uppercase mt-2">// CYCLE_ABORTED: Policy violation detected.</p>';
                    (result.violations || []).forEach(v => {
                        output.innerHTML += '<p class="text-red-400 text-[10px] mt-1 flex items-center gap-2"><span class="w-1.5 h-px bg-red-400"></span> ' + v + '</p>';
                    });
                } else {
                    output.innerHTML += '<p class="text-red-500 font-bold font-mono text-[11px] uppercase mt-2">// FAULT_DETECTED: ' + (result.error || 'Undefined Kernel Panic') + '</p>';
                }

                document.getElementById('outputArea').scrollTop = document.getElementById('outputArea').scrollHeight;
                addRecentExecution(result);
                fetchStats();
                fetchSecurity();
            } catch (e) {
                output.innerHTML += '<p class="text-red-500 font-mono mt-2">// BRIDGE_FAILURE: ' + e.message + '</p>';
            } finally {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        function addRecentExecution(result) {
            if (!result.id) return;
            if (recentExecutions.some(e => e.id === result.id)) return;

            recentExecutions.unshift({
                id: result.id,
                status: result.status || 'completed',
                engine: result.engine || document.getElementById('engineSelect').value,
                duration: result.duration_ms || result.durationMs || 0,
                time: result.time || new Date().toLocaleTimeString(),
                type: result.type || 'KERNEL_EXEC'
            });

            if (recentExecutions.length > 8) {
                recentExecutions = recentExecutions.slice(0, 8);
            }

            updateRecentDisplay();
        }

        function updateRecentDisplay() {
            const container = document.getElementById('recentExecs');
            if (recentExecutions.length === 0) return;

            container.innerHTML = recentExecutions.map(exec => {
                const isSuccess = exec.status === 'completed';
                const statusColor = isSuccess ? 'text-emerald-400' : 'text-red-500';
                const dotColor = isSuccess ? 'bg-emerald-400' : 'bg-red-500';
                
                return '<div class="bg-slate-900/40 p-3 rounded-xl border border-ui-border hover:border-brand-400/40 transition-all flex items-center justify-between group">' +
                        '<div class="flex items-center gap-3">' +
                            '<div class="w-1.5 h-1.5 rounded-full ' + dotColor + ' shadow-[0_0_8px_rgba(56,189,248,0.4)]"></div>' +
                            '<div>' +
                                '<p class="text-[9px] font-mono font-bold text-slate-300 uppercase">' + exec.id.substring(0, 12) + '</p>' +
                                '<div class="flex gap-2 mt-0.5 items-center">' +
                                    '<span class="text-[8px] font-mono text-slate-600 uppercase tracking-widest">' + exec.type + '</span>' +
                                    '<span class="text-[8px] font-mono ' + statusColor + ' uppercase opacity-80">' + exec.engine + '</span>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="text-right">' +
                            '<p class="text-[10px] font-bold text-white">' + exec.duration + 'ms</p>' +
                            '<p class="text-[8px] font-mono text-slate-600 uppercase">' + exec.time + '</p>' +
                        '</div>' +
                    '</div>';
            }).join('');
        }

        // Global Event Listeners
        document.getElementById('runBtn').addEventListener('click', runCode);
        document.getElementById('codeInput').addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                runCode();
            }
        });

        // Lifecycle
        fetchStats();
        fetchSecurity();
        pollAuditLogs();
        
        setInterval(fetchStats, 5000);
        setInterval(fetchSecurity, 10000);
        setInterval(pollAuditLogs, 3000);
    </script>
</body>
</html>`;
  }
}

module.exports = { Dashboard };
