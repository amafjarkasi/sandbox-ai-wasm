/**
 * SandboxAI - Security Policy Engine
 * Defines and enforces execution policies for sandboxed code
 * With comprehensive dangerous code detection
 */

const DEFAULT_POLICIES = {
  strict: {
    timeout: 5000,
    memory: "32mb",
    network: "none",
    filesystem: "none",
    modules: ["node:buffer", "node:crypto", "node:url", "node:util"],
    env: {},
    maxOutputSize: "512kb",
    maxArraySize: 10000,
    allowEval: false,
    allowRequire: false,
    allowChildProcess: false,
    allowWorkerThreads: false,
    allowNativeModules: false,
  },
  standard: {
    timeout: 15000,
    memory: "64mb",
    network: "restricted",
    allowedDomains: [],
    filesystem: "readonly",
    modules: [
      "node:buffer", "node:crypto", "node:url", "node:util",
      "node:path", "node:stream", "node:events", "node:http",
    ],
    env: {},
    maxOutputSize: "1mb",
    maxArraySize: 100000,
    allowEval: false,
    allowRequire: true,
    allowChildProcess: false,
    allowWorkerThreads: false,
    allowNativeModules: false,
  },
  extended: {
    timeout: 30000,
    memory: "128mb",
    network: "full",
    filesystem: "readwrite",
    modules: "all",
    env: "inherit",
    maxOutputSize: "5mb",
    maxArraySize: 1000000,
    allowEval: true,
    allowRequire: true,
    allowChildProcess: false,
    allowWorkerThreads: false,
    allowNativeModules: false,
  },
  agent: {
    timeout: 60000,
    memory: "256mb",
    network: "full",
    filesystem: "readonly",
    modules: "all",
    env: {},
    maxOutputSize: "10mb",
    maxArraySize: 1000000,
    allowEval: true,
    allowRequire: true,
    allowChildProcess: false,
    allowWorkerThreads: true,
    allowNativeModules: false,
  },
};

// Dangerous code patterns for detection
const DANGEROUS_PATTERNS = {
  codeInjection: {
    severity: "critical",
    patterns: [
      { regex: /\beval\s*\(/, desc: "eval() execution" },
      { regex: /\bFunction\s*\(\s*["']/, desc: "Dynamic Function constructor" },
      { regex: /setTimeout\s*\(\s*["'][^"']+["']/, desc: "setTimeout with string" },
      { regex: /setInterval\s*\(\s*["'][^"']+["']/, desc: "setInterval with string" },
      { regex: /execScript|executeScript/, desc: "Script execution" },
    ],
  },
  processSpawning: {
    severity: "critical",
    patterns: [
      { regex: /require\s*\(\s*["']child_process["']\s*\)/, desc: "child_process module" },
      { regex: /spawn\s*\(|exec\s*\(|execSync\s*\(|execFile/, desc: "Process spawning" },
      { regex: /spawnSync|fork\s*\(/, desc: "Process forking" },
    ],
  },
  shellExecution: {
    severity: "critical",
    patterns: [
      { regex: /\b(sh|bash|zsh|cmd|powershell)\s+-c/, desc: "Shell execution" },
      { regex: /["']\s*;\s*(rm|del|format|mkfs)/, desc: "Dangerous shell command" },
      { regex: /\|\s*(sh|bash)/, desc: "Piped shell execution" },
      { regex: /`[^`]*\$\{[^}]*\}[^`]*`/, desc: "Template literal shell injection" },
    ],
  },
  filesystemDestruction: {
    severity: "high",
    patterns: [
      { regex: /fs\.unlinkSync\s*\(\s*["']\//, desc: "Root file deletion" },
      { regex: /fs\.rmdirSync\s*\(\s*["']\//, desc: "Root directory removal" },
      { regex: /fs\.rm\s*\([^)]*\{\s*recursive\s*:\s*true/, desc: "Recursive deletion" },
      { regex: /rm\s+-rf/, desc: "Force recursive delete command" },
    ],
  },
  networkExfiltration: {
    severity: "high",
    patterns: [
      { regex: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, desc: "Direct IP connection" },
      { regex: /fetch\s*\(\s*["']https?:\/\/[^"']*\?[^"']*(password|token|key|secret)/i, desc: "Exfiltration via URL params" },
      { regex: /post\s*\(\s*["']https?:\/\//i, desc: "HTTP POST to external" },
    ],
  },
  cryptoMining: {
    severity: "high",
    patterns: [
      { regex: /crypto\.createHash.*(sha256|md5).*for\s*\(\s*let\s+i\s*=\s*0/i, desc: "Potential hash mining loop" },
      { regex: /while\s*\(\s*true\s*\).*crypto/i, desc: "Infinite crypto operation" },
      { regex: /WebAssembly\.instantiate.*crypto/i, desc: "WASM crypto module" },
    ],
  },
  memoryExhaustion: {
    severity: "medium",
    patterns: [
      { regex: /Array\s*\(\s*\d{9,}\s*\)/, desc: "Large array allocation" },
      { regex: /Buffer\.alloc\s*\(\s*\d{9,}\s*\)/, desc: "Large buffer allocation" },
      { regex: /while\s*\(\s*true\s*\).*push/, desc: "Infinite array growth" },
    ],
  },
  prototypePollution: {
    severity: "high",
    patterns: [
      { regex: /Object\.prototype\.__proto__\s*=/, desc: "Prototype pollution via __proto__" },
      { regex: /Object\.prototype\.constructor/, desc: "Constructor manipulation" },
      { regex: /__defineGetter__|__defineSetter__/, desc: "Legacy getter/setter manipulation" },
    ],
  },
  workerThreads: {
    severity: "medium",
    patterns: [
      { regex: /require\s*\(\s*["']worker_threads["']\s*\)/, desc: "Worker threads module" },
      { regex: /new\s+Worker\s*\(/, desc: "Worker thread creation" },
      { regex: /isMainThread/, desc: "Worker thread detection" },
    ],
  },
  vmModule: {
    severity: "high",
    patterns: [
      { regex: /require\s*\(\s*["']vm["']\s*\)/, desc: "VM module access" },
      { regex: /vm\.runInNewContext|vm\.runInContext|vm\.runInThisContext/, desc: "VM code execution" },
      { regex: /vm\.Script/, desc: "VM Script compilation" },
    ],
  },
  nativeModules: {
    severity: "medium",
    patterns: [
      { regex: /require\s*\(\s*["']\.[^"']+\.node["']\s*\)/, desc: "Native addon loading" },
      { regex: /process\.dlopen|module\.require\.bindings/, desc: "Native module loading" },
    ],
  },
  reconnaissance: {
    severity: "low",
    patterns: [
      { regex: /process\.env\s*\[\s*["'](HOME|USER|USERNAME|PATH|PWD)/, desc: "Environment probing" },
      { regex: /os\.hostname|os\.userInfo|os\.networkInterfaces/, desc: "System info gathering" },
      { regex: /fs\.readdirSync\s*\(\s*["']\//, desc: "Root directory listing" },
    ],
  },
};

class PolicyEngine {
  constructor() {
    this.policies = { ...DEFAULT_POLICIES };
    this.customPolicies = new Map();
    this.dangerousPatterns = DANGEROUS_PATTERNS;
  }

  getPolicy(nameOrConfig) {
    if (typeof nameOrConfig === "string") {
      return this.policies[nameOrConfig] || this.policies.standard;
    }
    if (nameOrConfig && typeof nameOrConfig === "object") {
      const base = this.policies[nameOrConfig.extends || "standard"];
      return this._mergePolicies(base, nameOrConfig);
    }
    return this.policies.standard;
  }

  validate(policy) {
    const errors = [];
    const warnings = [];

    if (policy.timeout !== undefined) {
      if (typeof policy.timeout !== "number" || policy.timeout < 100) {
        errors.push("timeout must be a number >= 100ms");
      }
      if (policy.timeout > 300000) {
        warnings.push("timeout > 300s may cause resource exhaustion");
      }
    }

    if (policy.memory !== undefined) {
      const memMB = this._parseMemory(policy.memory);
      if (memMB < 8) {
        errors.push("memory must be at least 8mb");
      }
      if (memMB > 1024) {
        warnings.push("memory > 1024mb may not be available in WASM sandbox");
      }
    }

    const validNetworkPolicies = ["none", "restricted", "full"];
    if (policy.network !== undefined && !validNetworkPolicies.includes(policy.network)) {
      errors.push("network must be one of: " + validNetworkPolicies.join(", "));
    }

    const validFsPolicies = ["none", "readonly", "readwrite"];
    if (policy.filesystem !== undefined && !validFsPolicies.includes(policy.filesystem)) {
      errors.push("filesystem must be one of: " + validFsPolicies.join(", "));
    }

    if (policy.allowEval === true) {
      warnings.push("allowEval=true can lead to code injection vulnerabilities");
    }
    if (policy.allowChildProcess === true) {
      warnings.push("allowChildProcess=true breaks sandbox isolation");
    }
    if (policy.network === "full" && policy.filesystem === "readwrite") {
      warnings.push("Full network + readwrite filesystem provides minimal isolation");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      policy: errors.length === 0 ? this.getPolicy(policy) : null,
    };
  }

  registerPolicy(name, policy) {
    const validation = this.validate(policy);
    if (!validation.valid) {
      throw new Error("Invalid policy: " + validation.errors.join(", "));
    }
    this.customPolicies.set(name, policy);
    this.policies[name] = policy;
    return { name, policy };
  }

  /**
   * Comprehensive dangerous code analysis
   */
  analyzeDangerousCode(code) {
    const findings = [];
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    };

    for (const [category, config] of Object.entries(this.dangerousPatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.regex.test(code)) {
          const finding = {
            category,
            severity: config.severity,
            description: pattern.desc,
            pattern: pattern.regex.toString(),
          };
          findings.push(finding);
          summary[config.severity]++;
          summary.total++;
        }
      }
    }

    // Calculate risk score (0-100)
    const riskScore = Math.min(100, 
      summary.critical * 25 + 
      summary.high * 15 + 
      summary.medium * 5 + 
      summary.low * 1
    );

    return {
      isDangerous: findings.length > 0,
      riskScore,
      riskLevel: this._getRiskLevel(riskScore),
      summary,
      findings,
    };
  }

  _getRiskLevel(score) {
    if (score >= 75) return "CRITICAL";
    if (score >= 50) return "HIGH";
    if (score >= 25) return "MEDIUM";
    if (score > 0) return "LOW";
    return "SAFE";
  }

  checkCode(code, policy) {
    const resolvedPolicy = this.getPolicy(policy);
    const violations = [];

    // Run dangerous code analysis
    const dangerAnalysis = this.analyzeDangerousCode(code);

    // Policy-specific checks
    if (!resolvedPolicy.allowEval) {
      const evalFindings = dangerAnalysis.findings.filter(f => f.category === "codeInjection");
      if (evalFindings.length > 0) {
        violations.push("Code uses eval-like constructs which are not allowed");
      }
    }

    if (!resolvedPolicy.allowChildProcess) {
      const procFindings = dangerAnalysis.findings.filter(f => 
        f.category === "processSpawning" || f.category === "shellExecution"
      );
      if (procFindings.length > 0) {
        violations.push("Code attempts to spawn processes which are not allowed");
      }
    }

    if (!resolvedPolicy.allowWorkerThreads) {
      const workerFindings = dangerAnalysis.findings.filter(f => f.category === "workerThreads");
      if (workerFindings.length > 0) {
        violations.push("Code uses worker threads which are not allowed");
      }
    }

    if (resolvedPolicy.filesystem === "none" || resolvedPolicy.filesystem === "readonly") {
      const fsFindings = dangerAnalysis.findings.filter(f => f.category === "filesystemDestruction");
      if (fsFindings.length > 0) {
        violations.push("Code attempts dangerous filesystem operations");
      }
    }

    if (resolvedPolicy.network === "none") {
      const netFindings = dangerAnalysis.findings.filter(f => f.category === "networkExfiltration");
      if (netFindings.length > 0) {
        violations.push("Code attempts network access which is not allowed");
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
      dangerAnalysis,
    };
  }

  _mergePolicies(base, override) {
    const merged = { ...base };
    for (const key of Object.keys(override)) {
      if (key !== "extends" && override[key] !== undefined) {
        merged[key] = override[key];
      }
    }
    return merged;
  }

  _parseMemory(mem) {
    if (typeof mem === "number") return mem;
    const match = String(mem).match(/^(\d+)\s*(mb|kb|gb)?$/i);
    if (!match) return 0;
    const value = parseInt(match[1], 10);
    const unit = (match[2] || "mb").toLowerCase();
    if (unit === "kb") return value / 1024;
    if (unit === "gb") return value * 1024;
    return value;
  }
}

module.exports = { PolicyEngine, DEFAULT_POLICIES, DANGEROUS_PATTERNS };
