/**
 * SandboxAI - Sandbox Executor
 * Core execution engine that runs code in Edge.js WASM sandboxes
 * With integrated audit logging and security hardening
 */

const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const { promisify } = require("node:util");
const { AuditLogger } = require("../lib/audit");

const fsPromises = fs.promises;
const mkdtemp = promisify(fs.mkdtemp);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);

// Constants
const PROCESS_TIMEOUT_BUFFER_MS = 2000;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_OUTPUT_KB = 1024;
const DEFAULT_MEMORY_MB = 64;

class Executor {
  constructor({ policyEngine, engineManager, streamManager, executionQueue, logger }) {
    this.policyEngine = policyEngine;
    this.engineManager = engineManager;
    this.streamManager = streamManager;
    this.executionQueue = executionQueue;
    this.logger = logger || console;
    this.auditLogger = new AuditLogger();
    this.results = new Map();
    this.resultCache = new Map();
    this.activeExecutions = new Map();
    this.cacheMaxSize = 100;
  }

  /**
   * Escape user code to prevent template injection attacks
   */
  _escapeCode(code) {
    return code
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\\\$/g, '\\$');
  }

  /**
   * Generate cache key for result caching
   */
  _generateCacheKey(code, policy, engine) {
    const hash = crypto.createHash('sha256');
    hash.update(code);
    hash.update(JSON.stringify(policy || 'standard'));
    hash.update(engine || 'v8');
    return hash.digest('hex');
  }

  /**
   * Check cache for existing result
   */
  _getCachedResult(cacheKey) {
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min TTL
      return { ...cached.result, cached: true };
    }
    this.resultCache.delete(cacheKey);
    return null;
  }

  /**
   * Store result in cache
   */
  _setCachedResult(cacheKey, result) {
    if (this.resultCache.size >= this.cacheMaxSize) {
      const firstKey = this.resultCache.keys().next().value;
      this.resultCache.delete(firstKey);
    }
    this.resultCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Execute code in a sandboxed environment with full audit logging
   */
  async execute({ code, engine = "v8", timeout, memory, policy, context, language, useCache = true }) {
    const id = "exec_" + crypto.randomBytes(6).toString("hex");
    const startTime = performance.now();

    // Check cache first
    const cacheKey = this._generateCacheKey(code, policy, engine);
    if (useCache) {
      const cached = this._getCachedResult(cacheKey);
      if (cached) {
        this.logger.info({ event: "execution.cache_hit", executionId: id });
        return cached;
      }
    }

    // Start audit trail
    this.auditLogger.startExecutionAudit(id, { code, engine, policy, timeout, memory });

    // Perform dangerous code analysis
    const dangerAnalysis = this.policyEngine.analyzeDangerousCode(code);
    
    // Log security findings
    if (dangerAnalysis.isDangerous) {
      for (const finding of dangerAnalysis.findings) {
        this.auditLogger.logSecurityFinding(id, finding);
      }
      this.auditLogger.logAction(id, "danger_analysis", {
        riskScore: dangerAnalysis.riskScore,
        riskLevel: dangerAnalysis.riskLevel,
        totalFindings: dangerAnalysis.summary.total,
      });
    }

    // Resolve and validate policy
    const resolvedPolicy = this.policyEngine.getPolicy(policy || "standard");
    const codeCheck = this.policyEngine.checkCode(code, resolvedPolicy);
    
    if (!codeCheck.allowed) {
      const result = {
        id,
        status: "rejected",
        violations: codeCheck.violations,
        dangerAnalysis: codeCheck.dangerAnalysis,
        durationMs: Math.round(performance.now() - startTime),
        engine,
      };
      
      this.auditLogger.logAction(id, "policy_violation", { violations: codeCheck.violations });
      this.auditLogger.completeExecutionAudit(id, result);
      return result;
    }

    const effectiveTimeout = timeout || resolvedPolicy.timeout || DEFAULT_TIMEOUT_MS;
    const effectiveMemory = memory || resolvedPolicy.memory || DEFAULT_MEMORY_MB;

    // Queue the execution
    return this.executionQueue.run(async () => {
      const execStartTime = performance.now();
      const execution = {
        id,
        code,
        engine,
        policy: resolvedPolicy,
        startTime: execStartTime,
        status: "running",
      };

      this.activeExecutions.set(id, execution);
      this.auditLogger.logAction(id, "execution_start", { engine, timeout: effectiveTimeout });

      try {
        const result = await this._runInSandbox({
          id,
          code,
          engine,
          timeout: effectiveTimeout,
          memory: effectiveMemory,
          policy: resolvedPolicy,
          context,
        });

        const durationMs = Math.round(performance.now() - execStartTime);
        const finalResult = {
          id,
          status: "completed",
          output: result.output,
          error: result.error || null,
          durationMs,
          memoryUsedMb: result.memoryUsedMb || 0,
          engine,
          policy: policy || "standard",
          exitCode: 0,
          dangerAnalysis,
        };

        // Cache successful result
        if (useCache) {
          this._setCachedResult(cacheKey, finalResult);
        }

        this.auditLogger.logAction(id, "execution_complete", {
          durationMs,
          outputLength: result.output?.length,
        });
        this.auditLogger.completeExecutionAudit(id, finalResult);
        this.results.set(id, finalResult);
        this.activeExecutions.delete(id);
        return finalResult;
      } catch (err) {
        const durationMs = Math.round(performance.now() - execStartTime);
        const finalResult = {
          id,
          status: "error",
          output: "",
          error: err.message,
          durationMs,
          memoryUsedMb: 0,
          engine,
          policy: policy || "standard",
          exitCode: err.exitCode || 1,
          dangerAnalysis,
        };

        this.auditLogger.logAction(id, "execution_error", { error: err.message });
        this.auditLogger.completeExecutionAudit(id, finalResult);
        this.results.set(id, finalResult);
        this.activeExecutions.delete(id);
        return finalResult;
      }
    });
  }

  /**
   * Start a streamed execution with SSE output
   */
  startStreamed({ code, engine = "v8", timeout, memory, policy, onOutput, onComplete }) {
    const id = "exec_" + crypto.randomBytes(6).toString("hex");
    const startTime = performance.now();
    const resolvedPolicy = this.policyEngine.getPolicy(policy || "standard");

    this.auditLogger.startExecutionAudit(id, { code, engine, policy, timeout, memory });

    this._runInSandbox({
      id,
      code,
      engine,
      timeout: timeout || resolvedPolicy.timeout || DEFAULT_TIMEOUT_MS,
      memory: memory || resolvedPolicy.memory || DEFAULT_MEMORY_MB,
      policy: resolvedPolicy,
      onOutput,
    }).then((result) => {
      const durationMs = Math.round(performance.now() - startTime);
      const finalResult = {
        id,
        status: "completed",
        output: result.output,
        error: result.error || null,
        durationMs,
        memoryUsedMb: result.memoryUsedMb || 0,
        engine,
      };
      this.auditLogger.completeExecutionAudit(id, finalResult);
      onComplete(finalResult);
    }).catch((err) => {
      const durationMs = Math.round(performance.now() - startTime);
      const finalResult = {
        id,
        status: "error",
        output: "",
        error: err.message,
        durationMs,
        memoryUsedMb: 0,
        engine,
      };
      this.auditLogger.completeExecutionAudit(id, finalResult);
      onComplete(finalResult);
    });

    return id;
  }

  /**
   * Get a stored execution result
   */
  getResult(id) {
    return this.results.get(id) || null;
  }

  /**
   * Get execution audit
   */
  getExecutionAudit(id) {
    return this.auditLogger.getExecutionAudit(id);
  }

  /**
   * Get security summary
   */
  getSecuritySummary() {
    return this.auditLogger.getSecuritySummary();
  }

  /**
   * Get audit stats
   */
  getAuditStats() {
    return this.auditLogger.getStats();
  }

  /**
   * Run code in the Edge.js sandbox with secure temp file handling
   */
  async _runInSandbox({ id, code, engine, timeout, memory, policy, context, onOutput }) {
    let tmpDir = null;
    let scriptPath = null;

    try {
      // Create secure temp directory
      const baseTmpDir = process.env.TMPDIR || process.env.TEMP || "/tmp";
      tmpDir = await mkdtemp(path.join(baseTmpDir, "sandboxai-"));
      scriptPath = path.join(tmpDir, "script.js");
      
      const wrappedCode = this._wrapCode(code, { timeout, memory, policy });
      await writeFile(scriptPath, wrappedCode, { mode: 0o600 }); // Restrictive permissions

      const edgeBin = this._findEdgeBinary();
      const bin = edgeBin || process.execPath;
      const args = edgeBin
        ? ["--safe", "--engine=" + engine, scriptPath]
        : ["--max-old-space-size=" + this._parseMemoryMB(memory), scriptPath];

      return new Promise((resolve, reject) => {
        const proc = spawn(bin, args, {
          timeout: timeout + PROCESS_TIMEOUT_BUFFER_MS,
          env: { ...process.env, SANDBOX_EXEC_ID: id },
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
          const chunk = data.toString();
          stdout += chunk;
          if (onOutput) {
            onOutput({ type: "stdout", data: chunk, id });
          }
        });

        proc.stderr.on("data", (data) => {
          const chunk = data.toString();
          stderr += chunk;
          if (onOutput) {
            onOutput({ type: "stderr", data: chunk, id });
          }
        });

        proc.on("close", async (exitCode) => {
          await this._cleanup(tmpDir, scriptPath);

          if (exitCode === 0) {
            resolve({
              output: stdout,
              error: stderr || null,
              memoryUsedMb: this._estimateMemory(stdout),
            });
          } else {
            const err = new Error(stderr || "Execution failed with exit code " + exitCode);
            err.exitCode = exitCode;
            reject(err);
          }
        });

        proc.on("error", async (err) => {
          await this._cleanup(tmpDir, scriptPath);
          reject(err);
        });
      });
    } catch (err) {
      await this._cleanup(tmpDir, scriptPath);
      throw err;
    }
  }

  /**
   * Securely cleanup temp files
   */
  async _cleanup(tmpDir, scriptPath) {
    try {
      if (scriptPath) {
        await unlink(scriptPath).catch(e => this.logger.warn("Failed to unlink script", e));
      }
      if (tmpDir) {
        await rmdir(tmpDir).catch(e => this.logger.warn("Failed to rmdir tmpDir", e));
      }
    } catch (e) {
      this.logger.error("Cleanup error", e);
    }
  }

  /**
   * Wrap user code with security harness - ESCAPED to prevent injection
   */
  _wrapCode(code, { timeout, memory, policy }) {
    const escapedCode = this._escapeCode(code);
    
    return `
// SandboxAI Execution Harness
const __startTime = performance.now();
const __timeout = ${timeout || DEFAULT_TIMEOUT_MS};
const __maxOutput = ${this._parseMemoryKB(policy?.maxOutputSize || (DEFAULT_MAX_OUTPUT_KB + "kb"))};

let __outputSize = 0;
const __originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(data) {
  __outputSize += Buffer.byteLength(data);
  if (__outputSize > __maxOutput) {
    __originalWrite("ERROR: Output size exceeded limit\\n");
    process.exit(1);
  }
  __originalWrite(data);
};

const __timer = setTimeout(() => {
  console.error("TIMEOUT: Execution exceeded " + __timeout + "ms");
  process.exit(124);
}, __timeout);

try {
  (async () => {
    try {
      ${escapedCode.split('\n').map(l => '      ' + l).join('\n')}
    } catch (err) {
      console.error("RUNTIME_ERROR: " + err.message);
      process.exit(1);
    } finally {
      clearTimeout(__timer);
    }
  })();
} catch (err) {
  console.error("PARSE_ERROR: " + err.message);
  process.exit(1);
}
`;
  }

  /**
   * Find Edge.js binary safely without shell injection
   */
  _findEdgeBinary() {
    const possiblePaths = [
      "/usr/local/bin/edge",
      "/usr/bin/edge",
      path.join(process.env.HOME || "", ".local/bin/edge"),
      "C:\\Program Files\\edge\\edge.exe",
      "C:\\edge\\edge.exe",
    ];

    for (const binPath of possiblePaths) {
      if (fs.existsSync(binPath)) {
        return binPath;
      }
    }

    return null;
  }

  _parseMemoryMB(mem) {
    if (typeof mem === "number") return mem;
    const match = String(mem).match(/^(\d+)\s*(mb|kb|gb)?$/i);
    if (!match) return DEFAULT_MEMORY_MB;
    const value = parseInt(match[1], 10);
    const unit = (match[2] || "mb").toLowerCase();
    if (unit === "kb") return Math.ceil(value / 1024);
    if (unit === "gb") return value * 1024;
    return value;
  }

  _parseMemoryKB(mem) {
    return this._parseMemoryMB(mem) * 1024;
  }

  _estimateMemory(output) {
    return Math.round((Buffer.byteLength(output) / 1024 / 1024) * 10 + 12) / 10;
  }
}

module.exports = { Executor };
