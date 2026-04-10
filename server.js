/**
 * SandboxAI - Secure AI Code Execution Platform
 * Powered by Edge.js WASM Sandboxing
 *
 * Run with:
 *   edge server.js          (normal mode)
 *   edge --safe server.js   (WASM sandboxed mode)
 */

const http = require("node:http");
const { Executor } = require("./sandbox/executor");
const { PolicyEngine } = require("./sandbox/policy");
const { ExecutionQueue } = require("./lib/queue");
const { Dashboard } = require("./lib/dashboard");
const { AgentServer } = require("./lib/agent");
const { StreamManager } = require("./lib/streaming");
const { EngineManager } = require("./lib/engines");
const { ReportGenerator } = require("./lib/reporting");

// ============================================================================
// Configuration & Constants
// ============================================================================

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

// Security Configuration
const MAX_BODY_SIZE = parseInt(process.env.MAX_BODY_SIZE || "1048576", 10); // 1MB default
const API_KEY = process.env.API_KEY;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",") || ["*"];
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || "30000", 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10);

// ============================================================================
// Structured Logger
// ============================================================================

const logger = {
  _format(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta,
    };
    return JSON.stringify(logEntry);
  },

  info(message, meta) {
    console.log(this._format("info", message, meta));
  },

  warn(message, meta) {
    console.warn(this._format("warn", message, meta));
  },

  error(message, meta) {
    console.error(this._format("error", message, meta));
  },

  debug(message, meta) {
    if (process.env.DEBUG) {
      console.log(this._format("debug", message, meta));
    }
  },
};

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
  constructor(windowMs = RATE_LIMIT_WINDOW_MS, maxRequests = RATE_LIMIT_MAX_REQUESTS) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();

    // Periodically sweep stale entries to prevent unbounded growth
    this._cleanupInterval = setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      for (const [clientId, requests] of this.requests) {
        const valid = requests.filter((time) => time > windowStart);
        if (valid.length === 0) {
          this.requests.delete(clientId);
        } else {
          this.requests.set(clientId, valid);
        }
      }
    }, 60000);
    // Don't let the cleanup timer prevent process exit
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  isAllowed(clientId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create client entry
    let clientRequests = this.requests.get(clientId);
    if (!clientRequests) {
      clientRequests = [];
      this.requests.set(clientId, clientRequests);
    }

    // Remove old requests outside the window
    const validRequests = clientRequests.filter((time) => time > windowStart);
    this.requests.set(clientId, validRequests);

    // Check if under limit
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    return true;
  }

  getRemaining(clientId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const clientRequests = this.requests.get(clientId) || [];
    const validRequests = clientRequests.filter((time) => time > windowStart);
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(clientId) {
    const clientRequests = this.requests.get(clientId) || [];
    if (clientRequests.length === 0) return Date.now();
    return Math.min(...clientRequests) + this.windowMs;
  }
}

const rateLimiter = new RateLimiter();

// ============================================================================
// Initialize Core Components
// ============================================================================

const policyEngine = new PolicyEngine();
const engineManager = new EngineManager();
const streamManager = new StreamManager();
const executionQueue = new ExecutionQueue({
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || "10", 10),
  defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || "30000", 10),
});
const executor = new Executor({
  policyEngine,
  engineManager,
  streamManager,
  executionQueue,
});
const dashboard = new Dashboard({ executor, executionQueue, engineManager });
const agentServer = new AgentServer({ executor, policyEngine });
const reportGenerator = new ReportGenerator(executor.auditLogger);

// ============================================================================
// Execution Statistics
// ============================================================================

const stats = {
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  startTime: Date.now(),
  engineUsage: { v8: 0, jsc: 0, quickjs: 0 },
  averageDurationMs: 0,
  _totalDurationMs: 0,
};

function updateStats(result) {
  stats.totalExecutions++;
  if (result.status === "completed") {
    stats.successfulExecutions++;
  } else {
    stats.failedExecutions++;
  }
  stats.engineUsage[result.engine] = (stats.engineUsage[result.engine] || 0) + 1;
  const duration = result.durationMs || 0;
  stats._totalDurationMs += duration;
  stats.averageDurationMs = Math.round(stats._totalDurationMs / stats.totalExecutions);
}

// ============================================================================
// Middleware & Helpers
// ============================================================================

/**
 * Set CORS headers based on configuration
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = CORS_ORIGINS.includes("*")
    ? "*"
    : CORS_ORIGINS.includes(origin)
      ? origin
      : CORS_ORIGINS[0];

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
  res.setHeader("Access-Control-Expose-Headers", "X-RateLimit-Remaining, X-RateLimit-Reset");
}

/**
 * API Key Authentication Middleware
 */
function authenticateApiKey(req) {
  if (!API_KEY) {
    return { authenticated: true }; // Authentication disabled if no API_KEY set
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { authenticated: false, error: "Missing Authorization header" };
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || token !== API_KEY) {
    return { authenticated: false, error: "Invalid API key" };
  }

  return { authenticated: true };
}

/**
 * Read request body with size limit enforcement
 */
function readBody(req, maxSize = MAX_BODY_SIZE) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    req.on("data", (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        req.destroy();
        reject(new Error(`Request body exceeds maximum size of ${maxSize} bytes`));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

/**
 * Send JSON response
 */
function jsonResponse(res, status, data, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  res.writeHead(status, headers);
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Get client identifier for rate limiting
 */
function getClientId(req) {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
}

// ============================================================================
// HTTP Request Router
// ============================================================================

const server = http.createServer(async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  const url = new URL(req.url, "http://" + req.headers.host);
  const path = url.pathname;
  const method = req.method;

  // Set CORS headers
  setCorsHeaders(req, res);

  // Handle preflight
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Rate limiting
  const clientId = getClientId(req);
  if (!rateLimiter.isAllowed(clientId)) {
    logger.warn("Rate limit exceeded", { requestId, clientId, path });
    const resetTime = rateLimiter.getResetTime(clientId);
    jsonResponse(
      res,
      429,
      { error: "Rate limit exceeded", retryAfter: Math.ceil((resetTime - Date.now()) / 1000) },
      {
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime.toString(),
      }
    );
    return;
  }

  // Set rate limit headers
  res.setHeader("X-RateLimit-Remaining", rateLimiter.getRemaining(clientId).toString());
  res.setHeader("X-RateLimit-Reset", rateLimiter.getResetTime(clientId).toString());

  // Request timeout handling
  const requestTimeout = setTimeout(() => {
    logger.error("Request timeout", { requestId, path, duration: Date.now() - startTime });
    if (!res.headersSent) {
      jsonResponse(res, 504, { error: "Gateway timeout" });
    }
  }, REQUEST_TIMEOUT_MS);

  try {
    // Health check endpoint (no auth required)
    if (method === "GET" && path === "/health") {
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Math.round((Date.now() - stats.startTime) / 1000),
        version: process.env.npm_package_version || "1.0.0",
        checks: {
          executor: !!executor,
          policyEngine: !!policyEngine,
          engineManager: !!engineManager,
        },
      });
      return;
    }

    // Authenticate API requests (except health check)
    const auth = authenticateApiKey(req);
    if (!auth.authenticated) {
      clearTimeout(requestTimeout);
      logger.warn("Authentication failed", { requestId, path, error: auth.error });
      jsonResponse(res, 401, { error: auth.error });
      return;
    }

    // POST /api/execute - Execute code in a sandbox
    if (method === "POST" && path === "/api/execute") {
      const body = await readBody(req);
      const params = JSON.parse(body);

      // Input validation
      if (!params.code || typeof params.code !== "string") {
        clearTimeout(requestTimeout);
        jsonResponse(res, 400, { error: "Missing or invalid 'code' field (must be a string)" });
        return;
      }
      const validEngines = ["v8", "jsc", "quickjs"];
      if (params.engine && !validEngines.includes(params.engine)) {
        clearTimeout(requestTimeout);
        jsonResponse(res, 400, { error: `Invalid engine. Must be one of: ${validEngines.join(", ")}` });
        return;
      }
      if (params.timeout !== undefined && (typeof params.timeout !== "number" || params.timeout <= 0)) {
        clearTimeout(requestTimeout);
        jsonResponse(res, 400, { error: "Invalid timeout (must be a positive number)" });
        return;
      }
      const validPolicies = ["strict", "standard", "extended", "agent"];
      if (params.policy && typeof params.policy === "string" && !validPolicies.includes(params.policy)) {
        clearTimeout(requestTimeout);
        jsonResponse(res, 400, { error: `Invalid policy. Must be one of: ${validPolicies.join(", ")}` });
        return;
      }

      logger.info("Executing code", {
        requestId,
        engine: params.engine,
        language: params.language,
        hasPolicy: !!params.policy,
      });

      const result = await executor.execute({
        code: params.code,
        engine: params.engine || "v8",
        timeout: params.timeout,
        memory: params.memory,
        policy: params.policy,
        context: params.context,
        language: params.language || "javascript",
      });

      updateStats(result);

      logger.info("Execution completed", {
        requestId,
        status: result.status,
        durationMs: result.durationMs,
      });

      clearTimeout(requestTimeout);
      jsonResponse(res, 200, result);
      return;
    }

    // POST /api/execute/stream - Execute with SSE streaming
    if (method === "POST" && path === "/api/execute/stream") {
      const body = await readBody(req);
      const params = JSON.parse(body);

      logger.info("Starting streamed execution", {
        requestId,
        engine: params.engine,
        language: params.language,
      });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      clearTimeout(requestTimeout);

      executor.startStreamed({
        code: params.code,
        engine: params.engine || "v8",
        timeout: params.timeout,
        memory: params.memory,
        policy: params.policy,
        onOutput: (data) => {
          res.write("data: " + JSON.stringify(data) + "\n\n");
        },
        onComplete: (result) => {
          updateStats(result);
          res.write("data: " + JSON.stringify({ type: "complete", ...result }) + "\n\n");
          res.end();

          logger.info("Streamed execution completed", {
            requestId,
            status: result.status,
          });
        },
      });
      return;
    }

    // GET /api/execute/:id - Get execution result
    if (method === "GET" && path.startsWith("/api/execute/")) {
      const id = path.split("/api/execute/")[1];
      const result = executor.getResult(id);
      if (!result) {
        clearTimeout(requestTimeout);
        jsonResponse(res, 404, { error: "Execution not found" });
        return;
      }
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, result);
      return;
    }

    // GET /api/stats - Platform statistics
    if (method === "GET" && path === "/api/stats") {
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, {
        ...stats,
        uptime_seconds: Math.round((Date.now() - stats.startTime) / 1000),
        queue: executionQueue.getStatus(),
        engines: engineManager.getStatus(),
      });
      return;
    }

    // GET /api/engines - Available JS engines
    if (method === "GET" && path === "/api/engines") {
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, engineManager.listEngines());
      return;
    }

    // POST /api/policies/validate - Validate a security policy
    if (method === "POST" && path === "/api/policies/validate") {
      const body = await readBody(req);
      const policy = JSON.parse(body);
      const validation = policyEngine.validate(policy);
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, validation);
      return;
    }

    // POST /api/analyze - Analyze code for dangerous patterns
    if (method === "POST" && path === "/api/analyze") {
      const body = await readBody(req);
      const params = JSON.parse(body);
      const analysis = policyEngine.analyzeDangerousCode(params.code);
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, { analysis });
      return;
    }

    // Audit Routes
    // GET /api/audit/execution/:id - Get execution audit
    if (method === "GET" && path.startsWith("/api/audit/execution/")) {
      const id = path.split("/api/audit/execution/")[1];
      const audit = executor.getExecutionAudit(id);
      if (!audit) {
        clearTimeout(requestTimeout);
        jsonResponse(res, 404, { error: "Audit not found" });
        return;
      }
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, audit);
      return;
    }

    // GET /api/audit/security-summary - Get security summary
    if (method === "GET" && path === "/api/audit/security-summary") {
      const summary = executor.getSecuritySummary();
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, summary);
      return;
    }

    // GET /api/audit/stats - Get audit statistics
    if (method === "GET" && path === "/api/audit/stats") {
      const auditStats = executor.getAuditStats();
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, auditStats);
      return;
    }

    // GET /api/audit/executions - List all execution audits
    if (method === "GET" && path === "/api/audit/executions") {
      const audits = executor.auditLogger?.getAllExecutionAudits() || [];
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, { audits });
      return;
    }

    // MCP Agent Routes
    // POST /mcp/tools/execute - MCP tool endpoint for AI agents
    if (method === "POST" && path === "/mcp/tools/execute") {
      const body = await readBody(req);
      const params = JSON.parse(body);
      const result = await agentServer.handleToolCall("execute", params);
      updateStats(result);
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, result);
      return;
    }

    // GET /mcp/tools - List available MCP tools
    if (method === "GET" && path === "/mcp/tools") {
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, agentServer.listTools());
      return;
    }

    // POST /mcp/tools/:name - Call any MCP tool
    if (method === "POST" && path.startsWith("/mcp/tools/")) {
      const toolName = path.split("/mcp/tools/")[1];
      const body = await readBody(req);
      const params = JSON.parse(body);
      const result = await agentServer.handleToolCall(toolName, params);
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, result);
      return;
    }

    if (path === "/" || path === "/dashboard") {
      console.log(`[DEBUG] Serving Nebula Dashboard for request: ${requestId}`);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(dashboard.render());
      return;
    }

    // Security Dashboard
    if (path === "/security") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(renderSecurityDashboard());
      return;
    }

    // Report Routes
    // GET /api/reports/execution/:id - Generate execution report
    if (method === "GET" && path.startsWith("/api/reports/execution/")) {
      const id = path.split("/api/reports/execution/")[1];
      const format = url.searchParams.get("format") || "json";
      const report = reportGenerator.generateExecutionReport(id);
      if (!report) {
        clearTimeout(requestTimeout);
        jsonResponse(res, 404, { error: "Execution not found" });
        return;
      }
      const exported = reportGenerator.export(report, format);
      clearTimeout(requestTimeout);
      res.writeHead(200, { "Content-Type": format === "json" ? "application/json" : "text/plain" });
      res.end(exported);
      return;
    }

    // GET /api/reports/batch - Generate batch report
    if (method === "GET" && path === "/api/reports/batch") {
      const executionIds = url.searchParams.get("ids")?.split(",") || [];
      const format = url.searchParams.get("format") || "json";
      const report = reportGenerator.generateBatchReport(executionIds);
      const exported = reportGenerator.export(report, format);
      clearTimeout(requestTimeout);
      res.writeHead(200, { "Content-Type": format === "json" ? "application/json" : "text/plain" });
      res.end(exported);
      return;
    }

    // GET /api/reports/incident/:id - Generate incident report
    if (method === "GET" && path.startsWith("/api/reports/incident/")) {
      const id = path.split("/api/reports/incident/")[1];
      const report = reportGenerator.generateSecurityIncidentReport(id);
      if (!report) {
        clearTimeout(requestTimeout);
        jsonResponse(res, 404, { error: "No security incident found for this execution" });
        return;
      }
      clearTimeout(requestTimeout);
      jsonResponse(res, 200, report);
      return;
    }

    // 404
    clearTimeout(requestTimeout);
    jsonResponse(res, 404, { error: "Not found", path });
  } catch (err) {
    clearTimeout(requestTimeout);
    logger.error("Request error", {
      requestId,
      path,
      method,
      error: err.message,
      stack: err.stack,
    });

    if (err.message?.includes("exceeds maximum size")) {
      jsonResponse(res, 413, { error: "Payload too large", message: err.message });
    } else if (err instanceof SyntaxError) {
      jsonResponse(res, 400, { error: "Invalid JSON", message: err.message });
    } else {
      jsonResponse(res, 500, { error: "Internal server error", message: err.message });
    }
  }
});

// ============================================================================
// Security Dashboard HTML
// ============================================================================

function renderSecurityDashboard() {
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>OBSIDIAN VAULT | Security Intelligence</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        vault: {
                            black: "#020202",
                            charcoal: "#0a0a0b",
                            slate: "#161618",
                            grey: "#2c2c2e",
                            accent: "#ff9d00", // Tactical Amber
                            cyan: "#00f2ff",
                            danger: "#ff3b30",
                            success: "#34c759"
                        }
                    },
                    fontFamily: {
                        headline: ["Space Grotesk", "sans-serif"],
                        mono: ["JetBrains Mono", "monospace"]
                    },
                    animation: {
                        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        'scan': 'scan 3s linear infinite',
                        'flicker': 'flicker 0.1s infinite',
                        'data-stream': 'data-stream 20s linear infinite'
                    },
                    keyframes: {
                        scan: {
                            '0%': { transform: 'translateY(-100%)' },
                            '100%': { transform: 'translateY(1000%)' }
                        },
                        flicker: {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.8 }
                        },
                        'data-stream': {
                            '0%': { transform: 'translateY(0)' },
                            '100%': { transform: 'translateY(-50%)' }
                        }
                    }
                }
            }
        }
    </script>
    <style>
        @layer base {
            body { @apply bg-vault-black text-gray-400 font-mono; }
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
        }
        .vault-border { border: 1px solid rgba(255, 157, 0, 0.1); }
        .vault-border-glow { border: 1px solid rgba(255, 157, 0, 0.3); box-shadow: 0 0 15px rgba(255, 157, 0, 0.1); }
        .vault-panel { @apply bg-vault-charcoal/80 backdrop-blur-md border border-white/5; }
        .vault-gradient { background: linear-gradient(135deg, rgba(255, 157, 0, 0.05) 0%, rgba(0, 0, 0, 0) 100%); }
        
        .scanline {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 2px;
            background: linear-gradient(to bottom, transparent, rgba(255, 157, 0, 0.2), transparent);
            pointer-events: none;
            z-index: 50;
            animation: scan 4s linear infinite;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #020202; }
        ::-webkit-scrollbar-thumb { background: #161618; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #ff9d00; }

        .crt-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), 
                        linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
            background-size: 100% 3px, 3px 100%;
            pointer-events: none;
            z-index: 100;
        }
    </style>
</head>
<body class="overflow-x-hidden selection:bg-vault-accent selection:text-black">
    <div class="scanline"></div>
    <div class="crt-overlay"></div>

    <!-- Navigation -->
    <nav class="fixed top-0 w-full z-40 border-b border-white/5 bg-vault-black/50 backdrop-blur-xl">
        <div class="max-w-[1800px] mx-auto flex items-center justify-between px-6 py-4">
            <div class="flex items-center gap-6">
                <div class="flex flex-col">
                    <h1 class="font-headline text-lg font-bold tracking-[0.3em] text-vault-accent uppercase leading-none">OBSIDIAN VAULT</h1>
                    <span class="text-[9px] tracking-[0.5em] text-gray-500 uppercase mt-1">Sovereign Intelligence Unit</span>
                </div>
            </div>
            
            <div class="hidden lg:flex items-center gap-8">
                <div class="flex flex-col items-end mr-4 border-r border-white/10 pr-6">
                    <span class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">System Status</span>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-vault-success animate-pulse"></span>
                        <span class="text-[10px] text-vault-success font-bold uppercase tracking-widest">Nominal</span>
                    </div>
                </div>
                <div class="flex gap-4">
                    <a href="/dashboard" class="px-5 py-2 text-[10px] font-bold tracking-widest text-gray-400 hover:text-white transition-colors border border-transparent hover:border-white/10 uppercase">Monitor</a>
                    <a href="#" class="px-5 py-2 text-[10px] font-bold tracking-widest text-vault-accent border border-vault-accent/30 bg-vault-accent/5 uppercase">Tactical</a>
                    <a href="#" class="px-5 py-2 text-[10px] font-bold tracking-widest text-gray-400 hover:text-white transition-colors uppercase">Logs</a>
                </div>
            </div>

            <div class="flex items-center gap-4">
                <button onclick="loadData()" class="group relative px-6 py-2 bg-vault-accent text-black text-[10px] font-bold tracking-[0.2em] uppercase overflow-hidden hover:brightness-110 transition-all active:scale-95">
                    <span class="relative z-10 flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">refresh</span>
                        Rescan Perimeter
                    </span>
                    <div class="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                </button>
            </div>
        </div>
    </nav>

    <main class="pt-28 pb-12 px-6 max-w-[1800px] mx-auto">
        <!-- Dashboard Grid -->
        <div class="grid grid-cols-12 gap-6">
            
            <!-- Left: Telemetry Summary -->
            <div class="col-span-12 lg:col-span-3 space-y-6">
                <!-- Status Card -->
                <div class="vault-panel p-6 border-l-4 border-l-vault-accent relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <span class="material-symbols-outlined text-8xl">radar</span>
                    </div>
                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-6">
                            <span class="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase">Detection Engine</span>
                            <span class="text-[10px] font-bold text-vault-accent font-mono">v4.2.0-secure</span>
                        </div>
                        <div class="space-y-6">
                            <div>
                                <h2 class="text-4xl font-headline font-bold text-white tracking-tighter" id="totalExecs">0</h2>
                                <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mt-1">Total Scanned Blocks</p>
                            </div>
                            <div class="h-[1px] bg-white/5"></div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 class="text-xl font-headline font-bold text-vault-danger" id="dangerousCount">0</h3>
                                    <p class="text-[9px] font-bold uppercase tracking-widest text-gray-600">Threats</p>
                                </div>
                                <div>
                                    <h3 class="text-xl font-headline font-bold text-vault-cyan" id="blockedCount">0</h3>
                                    <p class="text-[9px] font-bold uppercase tracking-widest text-gray-600">Inhibited</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Severity Meters -->
                <div class="vault-panel p-6 border-white/5">
                    <h3 class="text-[10px] font-bold tracking-[0.3em] text-gray-500 uppercase mb-8 flex items-center gap-3">
                        <span class="material-symbols-outlined text-sm text-vault-accent">insights</span>
                        Severity Distribution
                    </h3>
                    <div class="space-y-6" id="severityBreakdown">
                        <!-- Loading -->
                        <div class="flex flex-col gap-4">
                            <div class="h-1 bg-white/5 w-full"></div>
                            <div class="h-1 bg-white/5 w-2/3"></div>
                            <div class="h-1 bg-white/5 w-3/4"></div>
                        </div>
                    </div>
                </div>

                <!-- Integrity Shield Overlay -->
                <div class="vault-panel p-6 bg-vault-accent/5 border border-vault-accent/20 group hover:border-vault-accent/40 transition-all">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="material-symbols-outlined text-vault-accent animate-pulse">shield_locked</span>
                        <h4 class="text-[10px] font-bold text-vault-accent uppercase tracking-widest">Integrity Active</h4>
                    </div>
                    <p class="text-[11px] leading-relaxed text-gray-500 italic mb-4">
                        All kernel activities are being enqueued via vault-audit-stream. Hashing: SHA-384.
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <span class="px-2 py-1 bg-vault-black border border-white/5 text-[8px] font-mono text-gray-500">AES_XTS_256</span>
                        <span class="px-2 py-1 bg-vault-black border border-white/5 text-[8px] font-mono text-gray-500">KMS_VAULT_LIVE</span>
                    </div>
                </div>
            </div>

            <!-- Middle: Live Feed -->
            <div class="col-span-12 lg:col-span-6">
                <div class="vault-panel h-[800px] flex flex-col border-white/10 relative overflow-hidden">
                    <!-- Deco corners -->
                    <div class="absolute top-0 left-0 w-4 h-4 border-t border-l border-vault-accent/30 pointer-events-none"></div>
                    <div class="absolute top-0 right-0 w-4 h-4 border-t border-r border-vault-accent/30 pointer-events-none"></div>
                    <div class="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-vault-accent/30 pointer-events-none"></div>
                    <div class="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-vault-accent/30 pointer-events-none"></div>

                    <div class="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-vault-black/30 backdrop-blur-md">
                        <div class="flex items-center gap-4">
                            <div class="relative">
                                <span class="material-symbols-outlined text-vault-cyan">terminal</span>
                                <div class="absolute inset-0 bg-vault-cyan/20 blur-md pointer-events-none"></div>
                            </div>
                            <h2 class="text-[11px] font-bold tracking-[0.4em] text-white uppercase font-headline">Intelligence Stream // Live Findings</h2>
                        </div>
                        <div class="flex items-center gap-6">
                           <div class="flex items-center gap-2">
                               <div class="w-1.5 h-1.5 rounded-full bg-vault-accent animate-ping"></div>
                               <span class="text-[9px] font-bold text-vault-accent uppercase tracking-widest">Listening...</span>
                           </div>
                        </div>
                    </div>

                    <div id="findingsList" class="flex-grow overflow-y-auto p-0 scroll-smooth">
                        <div class="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
                            <span class="material-symbols-outlined text-4xl animate-spin text-vault-accent/20">rebase_edit</span>
                            <span class="text-[10px] font-bold tracking-[0.5em] uppercase opacity-50">Calibrating sensors...</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: Analytics & Patterns -->
            <div class="col-span-12 lg:col-span-3 space-y-6">
                <!-- Critical Counter -->
                <div class="vault-panel p-6 border-white/5 relative bg-vault-danger/5">
                    <div class="flex justify-between items-center mb-8">
                        <h3 class="text-[10px] font-bold tracking-[0.3em] text-vault-danger uppercase">Critical Findings</h3>
                        <span class="material-symbols-outlined text-vault-danger animate-flicker">emergency_home</span>
                    </div>
                    <div class="flex items-baseline gap-4">
                        <span class="text-6xl font-headline font-bold text-white leading-none" id="criticalCount">0</span>
                        <span class="text-[10px] text-vault-danger font-bold uppercase tracking-widest">High Risk Events</span>
                    </div>
                    <div class="mt-6 flex gap-1">
                        <div class="flex-1 h-0.5 bg-vault-danger/20"></div>
                        <div class="flex-1 h-0.5 bg-vault-danger/50 animate-pulse"></div>
                        <div class="flex-1 h-0.5 bg-vault-danger/20"></div>
                    </div>
                </div>

                <!-- Category Heatmap -->
                <div class="vault-panel p-6 border-white/5 flex flex-col h-[525px]">
                    <h3 class="text-[10px] font-bold tracking-[0.3em] text-gray-500 uppercase mb-8 flex items-center gap-3">
                        <span class="material-symbols-outlined text-sm text-vault-cyan">grid_view</span>
                        Tactical Breakdown
                    </h3>
                    <div id="categoryBreakdown" class="flex-grow space-y-1 overflow-y-auto pr-2 custom-scroll">
                        <!-- Content injected by JS -->
                    </div>
                </div>

                <!-- Decoy: Coordinate System -->
                <div class="vault-panel p-4 border-dashed border-white/5 bg-transparent opacity-20 pointer-events-none select-none">
                    <div class="flex justify-between text-[8px] font-mono uppercase tracking-[0.3em] text-gray-600 mb-2">
                        <span>Grid Reference: 77-Alpha-9</span>
                        <span>S-00124</span>
                    </div>
                    <div class="aspect-video border border-white/5 relative overflow-hidden flex flex-col items-center justify-center">
                        <div class="absolute inset-x-0 h-[1px] bg-white/5 top-1/2"></div>
                        <div class="absolute inset-y-0 w-[1px] bg-white/5 left-1/2"></div>
                        <div class="w-8 h-8 rounded-full border border-vault-accent/20 animate-pulse"></div>
                        <div class="text-[7px] text-gray-700 font-mono mt-2 tracking-widest underline">TARGETING_ACTIVE</div>
                    </div>
                </div>
            </div>

        </div>
    </main>

    <!-- UI Overlay Footer -->
    <footer class="fixed bottom-0 w-full bg-vault-black/80 backdrop-blur-md border-t border-white/5 py-2 px-6 z-40">
        <div class="max-w-[1800px] mx-auto flex justify-between items-center">
            <div class="flex items-center gap-6">
                <span class="text-[8px] font-mono text-gray-600 uppercase tracking-widest">User ID: REDACTED</span>
                <span class="text-[8px] font-mono text-gray-600 uppercase tracking-widest">Session: ${Math.random().toString(36).substring(7).toUpperCase()}</span>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <div class="w-1 h-1 rounded-full bg-vault-cyan"></div>
                    <span class="text-[8px] font-mono text-vault-cyan uppercase tracking-[0.2em]">Telemetry: Encrypted</span>
                </div>
                <div class="w-[1px] h-3 bg-white/10"></div>
                <span class="text-[8px] font-mono text-gray-500 uppercase tracking-widest">Vault OS 2026.4 v9.2</span>
            </div>
        </div>
    </footer>

    <script>
        function escapeHtml(str) {
            if (str == null) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        async function loadData() {
            try {
                const res = await fetch('/api/audit/security-summary');
                const data = await res.json();

                // Stats
                animateValue('totalExecs', 0, data.totalExecutions || 0, 1000);
                animateValue('dangerousCount', 0, data.dangerousExecutions || 0, 1000);
                animateValue('blockedCount', 0, data.blockedExecutions || 0, 1000);
                animateValue('criticalCount', 0, (data.findingsBySeverity?.critical || 0), 1000);

                // Findings List
                const findingsList = document.getElementById('findingsList');
                if (data.recentFindings && data.recentFindings.length > 0) {
                    findingsList.innerHTML = data.recentFindings.map((f, idx) => {
                        const isCritical = f.severity === 'critical';
                        const accentColor = isCritical ? 'vault-danger' : f.severity === 'high' ? 'vault-accent' : 'vault-cyan';
                        const borderOpacity = isCritical ? 'border-vault-danger/30' : 'border-white/10';
                        
                        return \`
                            <div class="group relative px-8 py-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors overflow-hidden">
                                <div class="absolute left-0 top-0 w-1 h-full bg-\${accentColor} opacity-20 group-hover:opacity-100 transition-opacity"></div>
                                
                                <div class="flex items-center justify-between mb-4">
                                    <div class="flex items-center gap-4">
                                        <span class="px-2 py-0.5 border border-\${accentColor}/30 text-[9px] font-bold text-\${accentColor} uppercase tracking-widest bg-\${accentColor}/5">
                                            \${f.severity}
                                        </span>
                                        <span class="text-xs font-headline font-bold text-white tracking-wide uppercase">\${escapeHtml(f.category)}</span>
                                    </div>
                                    <span class="text-[9px] font-mono text-gray-600">\${new Date(f.timestamp).toLocaleTimeString()}</span>
                                </div>
                                
                                <p class="text-[12px] text-gray-500 leading-relaxed font-light mb-4 group-hover:text-gray-300 transition-colors">
                                    \${escapeHtml(f.description)}
                                </p>
                                
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-4">
                                        <span class="text-[8px] font-mono text-gray-700 tracking-tighter uppercase">ID: \${f.executionId.substring(0, 12)}...</span>
                                        <div class="w-1 h-1 rounded-full bg-gray-800"></div>
                                        <span class="text-[8px] font-mono text-gray-700 uppercase tracking-widest">Hashed Payload</span>
                                    </div>
                                    <button class="text-[9px] font-bold text-\${accentColor} uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all hover:underline underline-offset-4">
                                        Inspect Block
                                    </button>
                                </div>
                            </div>
                        \`;
                    }).join('');
                } else {
                    findingsList.innerHTML = \`
                        <div class="flex flex-col items-center justify-center h-full text-gray-600 gap-4 opacity-30">
                            <span class="material-symbols-outlined text-6xl">verified_user</span>
                            <span class="text-[10px] font-bold tracking-[0.5em] uppercase">Security Integrity Uncompromised</span>
                        </div>
                    \`;
                }

                // Severity Breakdown
                const sev = data.findingsBySeverity || {};
                const maxSev = Math.max(...Object.values(sev), 1);
                const sevOrder = ['critical', 'high', 'medium', 'low'];
                
                document.getElementById('severityBreakdown').innerHTML = sevOrder.map(s => {
                    const count = sev[s] || 0;
                    const percent = (count / maxSev) * 100;
                    const color = s === 'critical' ? 'bg-vault-danger shadow-[0_0_10px_rgba(255,59,48,0.3)]' : 
                                  s === 'high' ? 'bg-vault-accent shadow-[0_0_10px_rgba(255,157,0,0.3)]' : 
                                  'bg-vault-cyan shadow-[0_0_10px_rgba(0,242,255,0.3)]';
                    const text = s === 'critical' ? 'text-vault-danger' : 
                                 s === 'high' ? 'text-vault-accent' : 
                                 'text-vault-cyan';

                    return \`
                        <div class="group">
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-[9px] font-bold tracking-[0.2em] text-gray-600 uppercase group-hover:text-gray-400 transition-colors">\${s}</span>
                                <span class="text-[10px] font-mono font-bold \${text}">\${count}</span>
                            </div>
                            <div class="h-[3px] w-full bg-white/5 relative overflow-hidden">
                                <div class="h-full \${color} transition-all duration-700 ease-out" style="width: \${percent}%"></div>
                            </div>
                        </div>
                    \`;
                }).join('');

                // Category Breakdown
                const cats = data.findingsByCategory || {};
                document.getElementById('categoryBreakdown').innerHTML = Object.entries(cats)
                    .sort((a,b) => b[1] - a[1])
                    .map(([name, count]) => \`
                        <div class="flex items-center justify-between py-3 border-b border-white/5 group hover:bg-white/[0.01] transition-all px-1">
                            <span class="text-[10px] text-gray-500 group-hover:text-white transition-colors truncate max-w-[80%]" title="\${name}">\${escapeHtml(name)}</span>
                            <span class="text-[10px] font-mono font-bold text-vault-accent">\${count}</span>
                        </div>
                    \`).join('') || \`
                        <div class="flex flex-col items-center justify-center h-full opacity-20">
                            <span class="text-[10px] font-bold uppercase tracking-widest">No Pattern Data</span>
                        </div>
                    \`;

            } catch (e) {
                console.error('Core Telemetry Link Error:', e);
            }
        }

        function animateValue(id, start, end, duration) {
            const obj = document.getElementById(id);
            if (!obj) return;
            if (obj._timer) clearInterval(obj._timer);
            if (start === end) {
                obj.innerHTML = end.toLocaleString();
                return;
            }
            const range = end - start;
            let current = start;
            const increment = end > start ? 1 : -1;
            const stepTime = Math.abs(Math.floor(duration / (range === 0 ? 1 : range)));
            obj._timer = setInterval(() => {
                current += increment;
                obj.innerHTML = current.toLocaleString();
                if (current === end) {
                    clearInterval(obj._timer);
                }
            }, Math.max(stepTime, 20));
        }

        loadData();
        setInterval(loadData, 8000);
    </script>
</body>
</html>`;
}

// ============================================================================
// Start Server
// ============================================================================

server.listen(PORT, HOST, () => {
  const mode = process.env.EDGE_SAFE_MODE ? "SAFE (WASM sandboxed)" : "NORMAL (no sandbox)";
  logger.info("Server started", {
    mode,
    port: PORT,
    host: HOST,
    maxBodySize: MAX_BODY_SIZE,
    corsOrigins: CORS_ORIGINS,
    rateLimitWindow: RATE_LIMIT_WINDOW_MS,
    rateLimitMax: RATE_LIMIT_MAX_REQUESTS,
  });

  console.log("");
  console.log("  SandboxAI - Secure AI Code Execution Platform");
  console.log("  Mode: " + mode);
  console.log("  Port: " + PORT);
  console.log("  Dashboard: http://localhost:" + PORT + "/dashboard");
  console.log("  Security:  http://localhost:" + PORT + "/security");
  console.log("  Health:    http://localhost:" + PORT + "/health");
  console.log("  API: http://localhost:" + PORT + "/api/execute");
  console.log("  MCP: http://localhost:" + PORT + "/mcp/tools");
  console.log("");
});

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);

  // Stop accepting new connections
  server.close(() => {
    logger.info("Server closed, cleaning up resources");

    // Clean up stream manager timers and references
    streamManager.destroy();

    // Clear rate limiter cleanup interval
    if (rateLimiter._cleanupInterval) {
      clearInterval(rateLimiter._cleanupInterval);
    }

    logger.info("Shutdown complete");
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
