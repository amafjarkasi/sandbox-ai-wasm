/**
 * SandboxAI - Audit Logger
 * Tracks all actions, events, and security findings for analysis
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

class AuditLogger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), "logs");
    this.maxEntries = options.maxEntries || 10000;
    this.entries = [];
    this.executionAudits = new Map();
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log an audit event
   */
  log(event) {
    const entry = {
      id: this._generateId(),
      timestamp: new Date().toISOString(),
      type: event.type,
      severity: event.severity || "info",
      category: event.category || "general",
      executionId: event.executionId || null,
      source: event.source || "unknown",
      action: event.action,
      details: event.details || {},
      metadata: {
        pid: process.pid,
        memory: process.memoryUsage(),
      },
    };

    this.entries.push(entry);

    // Trim old entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Write to file for persistence
    this._persistEntry(entry);

    return entry;
  }

  /**
   * Start auditing an execution
   */
  startExecutionAudit(executionId, params) {
    const audit = {
      executionId,
      startTime: new Date().toISOString(),
      params: {
        engine: params.engine,
        policy: params.policy,
        timeout: params.timeout,
        codeLength: params.code?.length,
        codeHash: params.code ? this._hashCode(params.code) : null,
      },
      events: [],
      securityFindings: [],
      actions: [],
      status: "started",
    };

    this.executionAudits.set(executionId, audit);

    this.log({
      type: "execution.start",
      severity: "info",
      category: "execution",
      executionId,
      action: "Execution started",
      details: audit.params,
    });

    return audit;
  }

  /**
   * Log a security finding for an execution
   */
  logSecurityFinding(executionId, finding) {
    const audit = this.executionAudits.get(executionId);
    if (audit) {
      audit.securityFindings.push({
        ...finding,
        timestamp: new Date().toISOString(),
      });
    }

    this.log({
      type: "security.finding",
      severity: finding.severity,
      category: "security",
      executionId,
      action: `Security finding: ${finding.category}`,
      details: finding,
    });
  }

  /**
   * Log an action taken during execution
   */
  logAction(executionId, action, details = {}) {
    const audit = this.executionAudits.get(executionId);
    if (audit) {
      audit.actions.push({
        action,
        timestamp: new Date().toISOString(),
        details,
      });
    }

    this.log({
      type: "execution.action",
      severity: "info",
      category: "action",
      executionId,
      action,
      details,
    });
  }

  /**
   * Complete an execution audit
   */
  completeExecutionAudit(executionId, result) {
    const audit = this.executionAudits.get(executionId);
    if (!audit) return;

    audit.endTime = new Date().toISOString();
    audit.status = result.status;
    audit.result = {
      status: result.status,
      duration_ms: result.duration_ms,
      exit_code: result.exit_code,
      outputLength: result.output?.length,
      error: result.error,
    };

    this.log({
      type: "execution.complete",
      severity: result.status === "completed" ? "info" : "warning",
      category: "execution",
      executionId,
      action: `Execution ${result.status}`,
      details: audit.result,
    });

    // Persist full audit
    this._persistAudit(executionId, audit);

    return audit;
  }

  /**
   * Get audit for a specific execution
   */
  getExecutionAudit(executionId) {
    return this.executionAudits.get(executionId) || null;
  }

  /**
   * Get all execution audits
   */
  getAllExecutionAudits() {
    return Array.from(this.executionAudits.entries()).map(([id, audit]) => ({
      executionId: id,
      ...audit,
    }));
  }

  /**
   * Get security summary
   */
  getSecuritySummary() {
    const summary = {
      totalExecutions: this.executionAudits.size,
      dangerousExecutions: 0,
      blockedExecutions: 0,
      findingsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      findingsByCategory: {},
      recentFindings: [],
    };

    for (const audit of this.executionAudits.values()) {
      if (audit.securityFindings.length > 0) {
        summary.dangerousExecutions++;
      }
      if (audit.status === "rejected" || audit.status === "error") {
        summary.blockedExecutions++;
      }

      for (const finding of audit.securityFindings) {
        summary.findingsBySeverity[finding.severity]++;
        summary.findingsByCategory[finding.category] = 
          (summary.findingsByCategory[finding.category] || 0) + 1;
      }
    }

    // Get recent findings
    const allFindings = [];
    for (const audit of this.executionAudits.values()) {
      for (const finding of audit.securityFindings) {
        allFindings.push({
          executionId: audit.executionId,
          timestamp: finding.timestamp,
          ...finding,
        });
      }
    }
    summary.recentFindings = allFindings
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20);

    return summary;
  }

  /**
   * Get audit statistics
   */
  getStats() {
    return {
      totalEntries: this.entries.length,
      totalExecutions: this.executionAudits.size,
      bySeverity: this._countBy("severity"),
      byCategory: this._countBy("category"),
      byType: this._countBy("type"),
    };
  }

  /**
   * Search audit entries
   */
  search(filters = {}) {
    return this.entries.filter(entry => {
      if (filters.type && entry.type !== filters.type) return false;
      if (filters.severity && entry.severity !== filters.severity) return false;
      if (filters.category && entry.category !== filters.category) return false;
      if (filters.executionId && entry.executionId !== filters.executionId) return false;
      if (filters.startTime && new Date(entry.timestamp) < new Date(filters.startTime)) return false;
      if (filters.endTime && new Date(entry.timestamp) > new Date(filters.endTime)) return false;
      return true;
    });
  }

  /**
   * Export audit data
   */
  export(format = "json") {
    const data = {
      exportedAt: new Date().toISOString(),
      entries: this.entries,
      executions: this.getAllExecutionAudits(),
      securitySummary: this.getSecuritySummary(),
    };

    if (format === "json") {
      return JSON.stringify(data, null, 2);
    }

    if (format === "csv") {
      const headers = ["timestamp", "type", "severity", "category", "executionId", "action"];
      const rows = this.entries.map(e => [
        e.timestamp,
        e.type,
        e.severity,
        e.category,
        e.executionId || "",
        `"${e.action.replace(/"/g, '""')}"`,
      ]);
      return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    }

    return data;
  }

  _generateId() {
    return "audit_" + crypto.randomBytes(6).toString("hex");
  }

  _hashCode(code) {
    return crypto.createHash("sha256").update(code).digest("hex").substring(0, 16);
  }

  _persistEntry(entry) {
    const date = new Date().toISOString().split("T")[0];
    const logFile = path.join(this.logDir, `audit-${date}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  }

  _persistAudit(executionId, audit) {
    const auditFile = path.join(this.logDir, `execution-${executionId}.json`);
    fs.writeFileSync(auditFile, JSON.stringify(audit, null, 2));
  }

  _countBy(field) {
    const counts = {};
    for (const entry of this.entries) {
      const value = entry[field] || "unknown";
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }
}

module.exports = { AuditLogger };
