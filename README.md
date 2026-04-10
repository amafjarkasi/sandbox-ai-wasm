<div align="center">

# 🔒 SandboxAI

**Secure AI Code Execution Platform — powered by Edge.js WASM Sandboxing**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Edge.js](https://img.shields.io/badge/runtime-Edge.js-7c3aed)](https://edge.codes)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

Execute untrusted JavaScript safely in isolated WASM sandboxes with
multi-engine support, real-time streaming, security policy enforcement,
and a built-in AI agent interface.

</div>

---

## Why SandboxAI?

Running untrusted code is dangerous. SandboxAI wraps execution in Edge.js WASM containers, giving you:

- **Hard isolation** — code runs in a WASM sandbox, not on your host OS
- **Policy enforcement** — control network, filesystem, memory, and module access per-execution
- **Threat detection** — 11 categories of dangerous patterns analyzed before execution
- **Audit trail** — every execution is logged with full chain of custody

Perfect for AI agent tool-use, online code judges, webhook processors, and any workflow where you need to run code you don't trust.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/amafjarkasi/sandbox-ai-wasm.git
cd sandbox-ai-wasm

# Start in sandboxed mode (recommended)
edge --safe server.js

# Or normal mode (no WASM isolation)
edge server.js
```

The server starts on `http://localhost:3000`. Open `/dashboard` for the monitoring UI.

### Execute code

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "const fib = n => n <= 1 ? n : fib(n-1) + fib(n-2); console.log(fib(10));",
    "engine": "v8",
    "policy": "strict"
  }'
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      HTTP Server                         │
│  Rate Limiter → Auth → Input Validation → Router         │
└──────────────┬───────────────────────────────────────────┘
               │
    ┌──────────▼──────────┐
    │   Execution Queue   │  Priority-based concurrency control
    │   (settled flags)   │  with race-condition-safe timeouts
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   Policy Engine     │  11-category threat detection
    │   Risk scoring      │  + policy enforcement
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   Executor          │  Edge.js WASM sandbox
    │   ┌───┬───┬───┐     │  Multi-engine selection
    │   │V8 │JSC│QJS│     │  Result caching (SHA256)
    │   └───┴───┴───┘     │  LRU eviction (1000 entries)
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   Audit Logger      │  Async I/O persistence
    │   Chain of custody  │  JSONL + per-execution JSON
    └─────────────────────┘
```

---

## API Reference

### `POST /api/execute`

Execute code in a sandbox.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `code` | `string` | *required* | JavaScript source to execute |
| `engine` | `string` | `"v8"` | Engine: `v8`, `jsc`, `quickjs` |
| `policy` | `string` | `"standard"` | Policy: `strict`, `standard`, `extended`, `agent` |
| `timeout` | `number` | policy default | Max execution time (ms) |
| `memory` | `string` | policy default | Memory limit (e.g. `"64mb"`) |
| `context` | `object` | `{}` | Variables injected into scope |
| `language` | `string` | `"javascript"` | Language identifier |

**Response:**

```json
{
  "id": "exec_a1b2c3d4e5f6",
  "status": "completed",
  "output": "55\n",
  "engine": "v8",
  "durationMs": 12,
  "dangerAnalysis": {
    "score": 0,
    "level": "safe",
    "findings": []
  }
}
```

### `POST /api/execute/stream`

Same parameters as `/api/execute`, returns Server-Sent Events for real-time output.

### `GET /api/result/:id`

Retrieve a cached execution result by ID.

### `GET /api/stats`

Server statistics: execution counts, engine usage, average duration.

### `GET /api/engines`

List available engines and their status.

### `GET /api/audit/security-summary`

Security overview: findings by severity/category, recent threats.

### `GET /dashboard`

Interactive monitoring dashboard.

### `GET /security`

Security findings dashboard with real-time updates.

---

## Security Policies

| Policy | Timeout | Memory | Network | Filesystem | Use Case |
|--------|---------|--------|---------|------------|----------|
| **strict** | 5s | 32 MB | None | None | Untrusted user input |
| **standard** | 15s | 64 MB | Restricted | Read-only | General workloads |
| **extended** | 30s | 128 MB | Allowed | Read/Write | Trusted internal code |
| **agent** | 60s | 256 MB | Allowed | Read/Write | AI agent tool calls |

### Threat Detection Categories

SandboxAI scans code for 11 categories of dangerous patterns before execution:

1. Command execution (`exec`, `spawn`, `execSync`)
2. Code injection (`eval`, `new Function`, `vm.runInContext`)
3. File system access (`fs.readFile`, `fs.unlink`)
4. Network requests (`http.request`, `fetch`, `net.Socket`)
5. Prototype pollution (`__proto__`, `constructor.prototype`)
6. Module loading (`require`, dynamic `import()`)
7. Environment access (`process.env`, `process.exit`)
8. Buffer/memory manipulation
9. Timer abuse (`setInterval` flooding)
10. WebAssembly execution
11. Encoding tricks (hex/unicode obfuscation)

Each finding is scored and aggregated into a risk level: `safe`, `low`, `medium`, `high`, or `critical`.

---

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `API_KEY` | *(none)* | Optional authentication key |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `MAX_BODY_SIZE` | `1048576` | Max request body in bytes (1 MB) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `30` | Max requests per window |
| `EDGE_SAFE_MODE` | *(none)* | Set by `edge --safe` to enable WASM |

---

## MCP Agent Interface

SandboxAI exposes an [MCP](https://modelcontextprotocol.io)-compatible tool interface for AI agents:

```json
{
  "tool": "execute_code",
  "arguments": {
    "code": "console.log(Array.from({length: 5}, (_, i) => i * i))",
    "engine": "v8",
    "policy": "agent"
  }
}
```

The agent server handles tool discovery, execution, and structured result formatting. See [`lib/agent.js`](lib/agent.js) for the full interface.

---

## Examples

Run any example while the server is running:

```bash
node examples/quick-run.js
```

| Example | Description |
|---------|-------------|
| `quick-run.js` | Minimal execution demo |
| `ai-agent.js` | MCP tool integration |
| `data-pipeline.js` | SSE streaming pipeline |
| `moderate-data-processing.js` | CSV parsing & statistics |
| `moderate-api-mocking.js` | Mock API with test suite |
| `advanced-ai-agent.js` | NLP intent parsing with memory |
| `advanced-workflow-engine.js` | DAG-based workflow execution |
| `complex-parallel-execution.js` | Worker pools & MapReduce |
| `complex-streaming-pipeline.js` | Backpressure & windowing |
| `dangerous-scripts.js` | Threat detection showcase |
| `realworld-code-review-bot.js` | Automated PR security scanning |
| `realworld-data-transformer.js` | CSV/JSON transformation |
| `realworld-calculator-api.js` | Safe math expression eval |
| `realworld-webhook-handler.js` | Webhook processing |
| `realworld-template-engine.js` | XSS-safe template rendering |
| `realworld-api-tester.js` | Integration test runner |
| `realworld-format-converter.js` | JSON/YAML/CSV conversion |
| `realworld-chatbot-tool.js` | LLM tool execution |
| `realworld-scheduled-task.js` | Cron-style job runner |
| `realworld-code-runner.js` | Educational code judge |

---

## Project Structure

```
sandbox-ai-wasm/
├── server.js              # HTTP server, routing, middleware
├── sandbox/
│   ├── executor.js        # Core execution engine (Edge.js WASM)
│   └── policy.js          # Security policy engine & threat detection
├── lib/
│   ├── queue.js           # Priority execution queue
│   ├── agent.js           # MCP agent tool interface
│   ├── audit.js           # Audit logging (async JSONL persistence)
│   ├── streaming.js       # SSE stream manager
│   ├── engines.js         # Multi-engine manager
│   ├── dashboard.js       # Dashboard utilities
│   └── reporting.js       # Report generation
├── examples/              # 20 runnable examples
├── logs/                  # Runtime audit logs (gitignored)
└── public/                # Static assets
```

---

## License

[MIT](LICENSE)
