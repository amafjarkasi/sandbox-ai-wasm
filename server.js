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

    // Dashboard
    if (path === "/" || path === "/dashboard") {
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SandboxAI Security Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f23;
      color: #e0e0e0;
      line-height: 1.6;
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 2rem;
      border-bottom: 1px solid #2d2d44;
    }
    .header h1 {
      font-size: 2rem;
      background: linear-gradient(90deg, #ff4444, #ffaa00);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .card {
      background: #1a1a2e;
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid #2d2d44;
    }
    .card h3 {
      color: #888;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    .stat-value {
      font-size: 2.5rem;
      font-weight: 700;
    }
    .stat-value.critical { color: #ff4444; }
    .stat-value.high { color: #ffaa00; }
    .stat-value.medium { color: #ffdd00; }
    .stat-value.low { color: #00d4ff; }
    .stat-value.safe { color: #00ff88; }
    .finding {
      background: #0f0f23;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      border-left: 3px solid;
    }
    .finding.critical { border-left-color: #ff4444; }
    .finding.high { border-left-color: #ffaa00; }
    .finding.medium { border-left-color: #ffdd00; }
    .finding.low { border-left-color: #00d4ff; }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .finding-category {
      font-weight: 600;
      color: #fff;
    }
    .badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-critical { background: #ff444422; color: #ff4444; }
    .badge-high { background: #ffaa0022; color: #ffaa00; }
    .badge-medium { background: #ffdd0022; color: #ffdd00; }
    .badge-low { background: #00d4ff22; color: #00d4ff; }
    .finding-desc {
      color: #888;
      font-size: 0.875rem;
    }
    .refresh-btn {
      background: linear-gradient(135deg, #00d4ff, #7b2cbf);
      border: none;
      color: #fff;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    .refresh-btn:hover { opacity: 0.9; }
    .nav {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .nav a {
      color: #888;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
    }
    .nav a:hover, .nav a.active {
      background: #2d2d44;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security Dashboard</h1>
    <p>Real-time security monitoring and threat detection</p>
  </div>

  <div class="container">
    <div class="nav">
      <a href="/dashboard">Main Dashboard</a>
      <a href="/security" class="active">Security</a>
    </div>

    <div class="grid" id="summaryStats">
      <div class="card">
        <h3>Total Executions</h3>
        <div class="stat-value safe" id="totalExecs">-</div>
      </div>
      <div class="card">
        <h3>Dangerous Detected</h3>
        <div class="stat-value critical" id="dangerousCount">-</div>
      </div>
      <div class="card">
        <h3>Blocked</h3>
        <div class="stat-value high" id="blockedCount">-</div>
      </div>
      <div class="card">
        <h3>Critical Findings</h3>
        <div class="stat-value critical" id="criticalCount">-</div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3 style="color:#fff;">Recent Security Findings</h3>
        <button class="refresh-btn" onclick="loadData()">Refresh</button>
      </div>
      <div id="findingsList">
        <p style="color:#666;">Loading...</p>
      </div>
    </div>

    <div class="grid" style="margin-top:2rem;">
      <div class="card">
        <h3>Findings by Severity</h3>
        <div id="severityBreakdown"></div>
      </div>
      <div class="card">
        <h3>Findings by Category</h3>
        <div id="categoryBreakdown"></div>
      </div>
    </div>
  </div>

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

        document.getElementById('totalExecs').textContent = data.totalExecutions || 0;
        document.getElementById('dangerousCount').textContent = data.dangerousExecutions || 0;
        document.getElementById('blockedCount').textContent = data.blockedExecutions || 0;
        document.getElementById('criticalCount').textContent = data.findingsBySeverity?.critical || 0;

        // Render findings
        const findingsList = document.getElementById('findingsList');
        if (data.recentFindings && data.recentFindings.length > 0) {
          findingsList.innerHTML = data.recentFindings.map(f => \`
            <div class="finding \${escapeHtml(f.severity)}">
              <div class="finding-header">
                <span class="finding-category">\${escapeHtml(f.category)}</span>
                <span class="badge badge-\${escapeHtml(f.severity)}">\${escapeHtml(f.severity)}</span>
              </div>
              <div class="finding-desc">\${escapeHtml(f.description)}</div>
              <div style="color:#666;font-size:0.75rem;margin-top:0.5rem;">
                \${new Date(f.timestamp).toLocaleString()} | \${escapeHtml(f.executionId?.substring(0, 16))}...
              </div>
            </div>
          \`).join('');
        } else {
          findingsList.innerHTML = '<p style="color:#666;">No security findings yet.</p>';
        }

        // Render breakdowns
        const sev = data.findingsBySeverity || {};
        document.getElementById('severityBreakdown').innerHTML = \`
          <div style="display:flex;justify-content:space-between;padding:0.5rem 0;">
            <span>Critical</span><span style="color:#ff4444;font-weight:600;">\${sev.critical || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:0.5rem 0;">
            <span>High</span><span style="color:#ffaa00;font-weight:600;">\${sev.high || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:0.5rem 0;">
            <span>Medium</span><span style="color:#ffdd00;font-weight:600;">\${sev.medium || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:0.5rem 0;">
            <span>Low</span><span style="color:#00d4ff;font-weight:600;">\${sev.low || 0}</span>
          </div>
        \`;

        const cat = data.findingsByCategory || {};
        document.getElementById('categoryBreakdown').innerHTML = Object.entries(cat)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => \`
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;">
              <span>\${escapeHtml(name)}</span><span style="font-weight:600;">\${count}</span>
            </div>
          \`).join('') || '<p style="color:#666;">No data</p>';

      } catch (e) {
        console.error('Failed to load data:', e);
      }
    }

    loadData();
    setInterval(loadData, 5000);
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
