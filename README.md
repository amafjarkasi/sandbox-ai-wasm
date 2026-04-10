<div align="center">

# 🛡️ SandboxAI

**Secure AI Code Execution Platform with Sub-5ms Cold Starts**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Edge.js](https://img.shields.io/badge/Powered%20by-Edge.js-orange)](https://edgejs.org)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Enabled-purple)](https://webassembly.org)
[![Security](https://img.shields.io/badge/Security-Hardened-success)](https://github.com/amafjarkasi/sandboxai)

[Getting Started](#quick-start) • [API Reference](#api-reference) • [Security](#security-features) • [Examples](#examples)

</div>

---

## 🎯 The Problem

AI agents are transforming software development, but they face a critical bottleneck: **safely executing untrusted code**. Current solutions force you to choose between:

- **Docker containers**: 300ms+ cold starts — too slow for real-time AI interactions
- **VMs**: 1+ second startup — completely impractical for conversational AI
- **Browser sandboxes**: Fast but limited — no Node.js API access

**SandboxAI solves this** with WebAssembly sandboxing that delivers **<5ms cold starts** with **full Node.js compatibility**.

---

## ⚡ Performance Comparison

| Solution | Cold Start | Security Model | Node.js APIs | Best For |
|----------|-----------|----------------|--------------|----------|
| Docker | 300-500ms | Container isolation | Full | Long-running services |
| Firecracker VM | 125-250ms | MicroVM | Full | Serverless functions |
| **SandboxAI (Edge.js)** | **<5ms** | **WASM Sandbox** | **Full** | **Real-time AI agents** |
| Browser Isolate | <5ms | Same-origin | Limited | Frontend code |

**60x faster than Docker** with equivalent security guarantees.

---

## ✨ Key Features

### 🔒 Enterprise-Grade Security
- **WASM Sandboxing** — Hardware-enforced isolation via Edge.js `--safe` mode
- **11 Dangerous Pattern Categories** — Detect command injection, prototype pollution, ReDoS, and more
- **Fine-Grained Policies** — Control network, filesystem, memory, and execution time
- **Complete Audit Trail** — Every execution logged with chain of custody
- **API Key Authentication** — Bearer token auth with configurable CORS
- **Rate Limiting** — Per-client request throttling with configurable windows

### 🤖 AI-Native Architecture
- **MCP Protocol Support** — Model Context Protocol compatible for LLM agents
- **Streaming Output** — Server-Sent Events for real-time execution feedback
- **Multi-Engine Support** — V8, JavaScriptCore, QuickJS, SpiderMonkey, Hermes
- **Result Caching** — SHA256-based caching for repeated executions
- **Execution Queue** — Priority-based concurrency control

### 📊 Observability
- **Real-Time Dashboards** — Monitor executions, resources, and security events
- **Security Dashboard** — Track blocked attempts and dangerous code detections
- **Structured Logging** — JSON logs with correlation IDs
- **Health Checks** — Load balancer ready with `/health` endpoint
- **Comprehensive Reports** — Execution, batch, and incident reports

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Edge.js runtime
curl -fsSL https://edgejs.org/install | bash

# Verify installation
edge --version
```

### Installation

```bash
# Clone the repository
git clone https://github.com/amafjarkasi/sandboxai.git
cd sandboxai

# Install dependencies
npm install
```

### Running the Server

```bash
# Development mode (normal)
edge server.js

# Production mode (WASM sandboxed)
edge --safe server.js

# With authentication
API_KEY=$(openssl rand -hex 32) edge --safe server.js

# Full production config
API_KEY=$(openssl rand -hex 32) \
  CORS_ORIGINS=https://yourdomain.com \
  RATE_LIMIT_MAX_REQUESTS=100 \
  MAX_BODY_SIZE=1048576 \
  edge --safe server.js
```

The server will start on `http://localhost:3000` with:
- **Dashboard**: http://localhost:3000/dashboard
- **Security Dashboard**: http://localhost:3000/security
- **Health Check**: http://localhost:3000/health
- **API Docs**: http://localhost:3000/api/execute

---

## 📖 Usage Examples

### Basic Code Execution

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "code": "const data = [1,2,3,4,5]; const sum = data.reduce((a,b) => a+b, 0); console.log(sum);",
    "engine": "v8",
    "timeout": 5000,
    "memory": "64mb"
  }'
```

**Response:**
```json
{
  "id": "exec_a1b2c3d4",
  "status": "completed",
  "output": "15\n",
  "durationMs": 2,
  "memoryUsedMb": 8.4,
  "engine": "v8",
  "cached": false
}
```

### AI Agent Integration (MCP)

```javascript
// Tool definition for your LLM agent
const executeCodeTool = {
  name: "execute_javascript",
  description: "Execute JavaScript code in a secure sandbox",
  parameters: {
    code: "JavaScript code to execute",
    timeout: "Maximum execution time in ms (default: 30000)",
    memory: "Memory limit (default: 128mb)"
  }
};

// Call via MCP endpoint
const response = await fetch('http://localhost:3000/mcp/tools/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    code: 'fetch("https://api.example.com/data").then(r => r.json())',
    context: "Retrieving data for analysis"
  })
});
```

### Streaming Execution

```bash
curl -N http://localhost:3000/api/execute/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "code": "for(let i=0; i<10; i++) { console.log(`Step ${i}`); await new Promise(r => setTimeout(r, 500)); }"
  }'
```

**Output:**
```
data: {"type":"output","data":"Step 0","timestamp":1234567890}
data: {"type":"output","data":"Step 1","timestamp":1234567891}
...
data: {"type":"complete","id":"exec_xyz","status":"completed","durationMs":5002}
```

### Security Analysis

```bash
# Analyze code before execution
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "code": "require('child_process').exec('rm -rf /')"
  }'
```

**Response:**
```json
{
  "analysis": {
    "isDangerous": true,
    "riskScore": 95,
    "findings": [
      {
        "category": "command_execution",
        "severity": "critical",
        "description": "Detected child_process execution",
        "line": 1,
        "confidence": 0.98
      }
    ],
    "recommendations": [
      "Block execution immediately",
      "Review code for malicious intent"
    ]
  }
}
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `API_KEY` | — | Enable Bearer token authentication |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `MAX_BODY_SIZE` | `1048576` | Max request body (1MB) |
| `MAX_CONCURRENCY` | `10` | Max concurrent executions |
| `DEFAULT_TIMEOUT` | `30000` | Default execution timeout (ms) |
| `REQUEST_TIMEOUT_MS` | `30000` | HTTP request timeout (ms) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `CACHE_TTL_MS` | `300000` | Result cache TTL (5min) |

### Security Policies

```javascript
const policy = {
  // Resource limits
  timeout: 5000,           // 5 second max execution
  memory: "64mb",          // 64MB memory limit
  maxOutputSize: "1mb",    // 1MB max output
  
  // Network restrictions
  network: "none",         // Options: "all", "outbound", "none"
  allowedHosts: ["api.example.com"],  // Whitelist specific hosts
  
  // Filesystem restrictions
  filesystem: "readonly",  // Options: "all", "readonly", "none"
  allowedPaths: ["/tmp", "/data"],    // Whitelist paths
  
  // Module restrictions
  modules: ["node:crypto", "node:buffer"],  // Allowed modules
  blockedModules: ["child_process", "fs"],  // Blocked modules
  
  // Environment
  env: {                   // Injected environment variables
    NODE_ENV: "sandbox"
  },
  
  // Execution options
  allowEval: false,        // Block eval() and new Function()
  allowWasm: false,        // Block WebAssembly
  allowWorkers: false      // Block Worker threads
};
```

---

## 🏗️ Architecture

![SandboxAI Architecture](https://raw.githubusercontent.com/amafjarkasi/sandbox-ai-wasm/master/public/architecture.png)

**Layer Overview:**

| Layer | Components | Purpose |
|-------|------------|---------|
| **Interfaces** | HTTP API Server, MCP Agent Interface, Web Dashboard | Entry points for code execution |
| **Security Layer** | API Auth, Rate Limiter, CORS Policy, Body Limit | Request validation and protection |
| **Execution Queue** | Priority-based queue with timeout management | Concurrency and resource management |
| **Sandbox Executor** | Policy Engine, Resource Monitor, Result Cache | Secure code execution with caching |
| **WASM Sandbox** | V8, JSC, QuickJS, SpiderMonkey, Hermes | Isolated JavaScript runtimes |

---

## 🔐 Security Features

### Dangerous Pattern Detection

SandboxAI detects and blocks 11 categories of dangerous code patterns:

| Category | Severity | Description | Example Patterns |
|----------|----------|-------------|------------------|
| **Command Execution** | 🔴 Critical | System command injection | `child_process`, `exec`, `spawn`, `execSync` |
| **Code Injection** | 🔴 Critical | Dynamic code evaluation | `eval`, `new Function`, `vm.runInContext` |
| **File System** | 🔴 Critical | Unauthorized file access | `fs.writeFile`, `fs.unlink`, `fs.rmdir` |
| **Process** | 🔴 Critical | Process manipulation | `process.exit`, `process.kill`, `process.abort` |
| **Network** | 🟠 High | Unauthorized network access | `http.request`, `net.connect`, `fetch` to internal IPs |
| **Import/Require** | 🟠 High | Dynamic module loading | Dynamic `import()`, `require()` with variables |
| **Worker Threads** | 🟠 High | Thread spawning | `Worker`, `worker_threads`, `cluster` |
| **Prototype Pollution** | 🟠 High | Object prototype attacks | `__proto__`, `constructor.prototype` manipulation |
| **WASM** | 🟠 High | WebAssembly execution | `WebAssembly.instantiate` with untrusted buffers |
| **Regex DoS** | 🟡 Medium | ReDoS vulnerable patterns | Nested quantifiers, catastrophic backtracking |
| **Global This** | 🟡 Medium | Global object access | `globalThis`, `global` property modification |

### Audit & Compliance

```bash
# Get execution audit trail
curl http://localhost:3000/api/audit/execution/exec_a1b2c3d4 \
  -H "Authorization: Bearer your-api-key"
```

**Audit Event Structure:**
```json
{
  "executionId": "exec_a1b2c3d4",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "events": [
    {
      "type": "execution_started",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "code": "console.log('hello')",
      "engine": "v8"
    },
    {
      "type": "security_scan",
      "timestamp": "2024-01-15T10:30:00.001Z",
      "findings": [],
      "isDangerous": false
    },
    {
      "type": "execution_completed",
      "timestamp": "2024-01-15T10:30:00.003Z",
      "durationMs": 2,
      "exitCode": 0
    }
  ],
  "chainOfCustody": {
    "startedBy": "api_key_abc123",
    "ipAddress": "192.168.1.100",
    "userAgent": "curl/7.68.0"
  }
}
```

### Production Security Checklist

- [ ] **Enable API Authentication**: `API_KEY=$(openssl rand -hex 32)`
- [ ] **Configure CORS Whitelist**: `CORS_ORIGINS=https://app.yoursite.com`
- [ ] **Set Rate Limits**: `RATE_LIMIT_MAX_REQUESTS=50`
- [ ] **Limit Request Size**: `MAX_BODY_SIZE=524288` (512KB)
- [ ] **Use WASM Safe Mode**: `edge --safe server.js`
- [ ] **Enable Structured Logging**: `LOG_LEVEL=info`
- [ ] **Set Resource Limits**: `DEFAULT_TIMEOUT=10000`, `MAX_CONCURRENCY=5`
- [ ] **Configure Health Checks**: `/health` endpoint for load balancers

---

## 📊 Dashboards

### Main Dashboard

Access at `http://localhost:3000/dashboard`

**Features:**
- Real-time execution metrics
- Active sandbox monitoring
- Engine performance comparison
- Resource usage graphs
- Execution history with search

### Security Dashboard

Access at `http://localhost:3000/security`

**Features:**
- Security event timeline
- Blocked execution attempts
- Dangerous code detections by category
- Severity breakdown charts
- Recent security findings

---

## 🧪 Examples

### Basic Examples

```bash
# Hello World
edge examples/basic-hello-world.js

# Math calculation
edge examples/basic-math.js

# Array manipulation
edge examples/basic-arrays.js
```

### Moderate Complexity

```bash
# Data processing pipeline
edge examples/moderate-data-processing.js

# API mocking
edge examples/moderate-api-mocking.js
```

### Advanced Use Cases

```bash
# AI Agent with tool calling
edge examples/advanced-ai-agent.js

# Workflow engine
edge examples/advanced-workflow-engine.js
```

### Complex Scenarios

```bash
# Parallel execution
edge examples/complex-parallel-execution.js

# Streaming data pipeline
edge examples/complex-streaming-pipeline.js
```

---

## 🔌 API Reference

### Core Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| POST | `/api/execute` | Execute code | Yes |
| POST | `/api/execute/stream` | Stream execution | Yes |
| GET | `/api/execute/:id` | Get result | Yes |
| GET | `/api/stats` | Platform stats | Yes |
| POST | `/api/analyze` | Analyze code | Yes |
| POST | `/api/policies/validate` | Validate policy | Yes |

### Audit Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit/execution/:id` | Execution audit |
| GET | `/api/audit/security-summary` | Security summary |
| GET | `/api/audit/stats` | Audit statistics |
| GET | `/api/audit/executions` | List all audits |

### Report Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/execution/:id` | Execution report |
| GET | `/api/reports/batch` | Batch report |
| GET | `/api/reports/incident/:id` | Incident report |

### MCP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mcp/tools` | List tools |
| POST | `/mcp/tools/:name` | Call tool |

---

## 🛠️ Development

### Project Structure

```
sandboxai/
├── server.js                 # HTTP server & routing
├── package.json              # Dependencies & scripts
├── README.md                 # This file
├── sandbox/                  # Core sandboxing
│   ├── executor.js          # Code execution engine
│   └── policy.js            # Security policy engine
├── lib/                      # Supporting modules
│   ├── streaming.js         # SSE stream management
│   ├── queue.js             # Execution queue
│   ├── dashboard.js         # Web dashboard UI
│   ├── agent.js             # MCP agent interface
│   ├── engines.js           # JS engine management
│   ├── reporting.js         # Report generation
│   └── audit.js             # Audit logging
├── examples/                 # Usage examples
│   ├── basic-*
│   ├── moderate-*
│   ├── advanced-*
│   └── complex-*
├── docs/                     # Documentation
│   ├── security-gaps.md
│   └── quick-wins.md
└── public/                   # Static assets
```

### Running Tests

```bash
# Run all tests
npm test

# Run security tests
npm run test:security

# Run performance benchmarks
npm run benchmark
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Fork and clone
git clone https://github.com/yourusername/sandboxai.git
cd sandboxai

# Install dependencies
npm install

# Create branch
git checkout -b feature/your-feature

# Make changes and test
npm test

# Submit PR
git push origin feature/your-feature
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Powered by [Edge.js](https://edgejs.org) — The WebAssembly JavaScript runtime
- Inspired by the need for secure AI agent code execution
- Built for the Model Context Protocol (MCP) ecosystem

---

<div align="center">

**[⬆ Back to Top](#-sandboxai)**

Built with ❤️ for the AI agent community

</div>
