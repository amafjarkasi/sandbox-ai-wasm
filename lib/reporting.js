/**
 * SandboxAI - Audit Report Generator
 * Generates comprehensive execution reports and chain of custody
 */

const crypto = require("node:crypto");

class ReportGenerator {
  constructor(auditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Generate a comprehensive execution report
   */
  generateExecutionReport(executionId, options = {}) {
    const audit = this.auditLogger.getExecutionAudit(executionId);
    if (!audit) {
      return null;
    }

    const format = options.format || "detailed";
    const includeCode = options.includeCode !== false;

    const report = {
      reportId: `report_${crypto.randomBytes(4).toString("hex")}`,
      generatedAt: new Date().toISOString(),
      executionId: audit.executionId,
      format,
      version: "1.0",

      // Chain of custody
      chainOfCustody: this._generateChainOfCustody(audit),

      // Execution summary
      summary: {
        status: audit.status,
        startTime: audit.startTime,
        endTime: audit.endTime,
        durationMs: audit.result?.duration_ms,
        engine: audit.params?.engine,
        policy: audit.params?.policy,
        riskLevel: this._calculateRiskLevel(audit),
      },

      // Security analysis
      security: {
        totalFindings: audit.securityFindings?.length || 0,
        findingsBySeverity: this._groupBySeverity(audit.securityFindings),
        findingsByCategory: this._groupByCategory(audit.securityFindings),
        findings: audit.securityFindings || [],
        wasBlocked: audit.status === "rejected",
        blockReason: this._getBlockReason(audit),
      },

      // Timeline of events
      timeline: this._generateTimeline(audit),

      // Actions taken
      actions: audit.actions || [],

      // Metadata
      metadata: {
        codeHash: audit.params?.codeHash,
        codeLength: audit.params?.codeLength,
        outputLength: audit.result?.outputLength,
        exitCode: audit.result?.exit_code,
        ...(includeCode && { codePreview: this._getCodePreview(audit) }),
      },

      // Compliance info
      compliance: {
        dataRetention: "90 days",
        tamperProof: this._generateTamperProofHash(audit),
        auditVersion: "1.0",
      },
    };

    return report;
  }

  /**
   * Generate a batch report for multiple executions
   */
  generateBatchReport(executionIds, options = {}) {
    const reports = executionIds
      .map(id => this.generateExecutionReport(id, { ...options, format: "summary" }))
      .filter(r => r !== null);

    return {
      reportId: `batch_${crypto.randomBytes(4).toString("hex")}`,
      generatedAt: new Date().toISOString(),
      type: "batch",
      count: reports.length,
      summary: {
        totalExecutions: reports.length,
        completed: reports.filter(r => r.summary.status === "completed").length,
        rejected: reports.filter(r => r.summary.status === "rejected").length,
        errors: reports.filter(r => r.summary.status === "error").length,
        dangerous: reports.filter(r => r.security.totalFindings > 0).length,
      },
      riskDistribution: this._calculateRiskDistribution(reports),
      executions: reports,
    };
  }

  /**
   * Generate a security incident report
   */
  generateSecurityIncidentReport(executionId) {
    const audit = this.auditLogger.getExecutionAudit(executionId);
    if (!audit || audit.securityFindings.length === 0) {
      return null;
    }

    return {
      reportId: `incident_${crypto.randomBytes(4).toString("hex")}`,
      type: "security_incident",
      generatedAt: new Date().toISOString(),
      severity: this._getHighestSeverity(audit.securityFindings),

      incident: {
        executionId: audit.executionId,
        timestamp: audit.startTime,
        classification: this._classifyIncident(audit),
        description: this._generateIncidentDescription(audit),
      },

      evidence: {
        codeHash: audit.params?.codeHash,
        findings: audit.securityFindings,
        actions: audit.actions,
        timeline: this._generateTimeline(audit),
      },

      response: {
        wasBlocked: audit.status === "rejected",
        actionsTaken: audit.actions.filter(a =>
          a.action.includes("violation") || a.action.includes("blocked")
        ),
        recommendedActions: this._generateRecommendations(audit),
      },

      indicators: {
        ioc: this._extractIOCs(audit),
        patterns: audit.securityFindings.map(f => f.pattern),
        techniques: this._mapToMITRE(audit.securityFindings),
      },
    };
  }

  /**
   * Export report in various formats
   */
  export(report, format = "json") {
    switch (format.toLowerCase()) {
      case "json":
        return JSON.stringify(report, null, 2);

      case "markdown":
        return this._toMarkdown(report);

      case "html":
        return this._toHTML(report);

      case "csv":
        return this._toCSV(report);

      case "siem":
        return this._toSIEMFormat(report);

      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Generate chain of custody documentation
   */
  _generateChainOfCustody(audit) {
    const chain = [];

    // Entry point
    chain.push({
      step: 1,
      timestamp: audit.startTime,
      event: "Code submitted for execution",
      actor: "user",
      evidence: `Code hash: ${audit.params?.codeHash}`,
    });

    // Analysis
    const analysisAction = audit.actions.find(a => a.action === "danger_analysis");
    if (analysisAction) {
      chain.push({
        step: 2,
        timestamp: analysisAction.timestamp,
        event: "Security analysis completed",
        actor: "system",
        evidence: `Risk level: ${analysisAction.details?.riskLevel}, Findings: ${analysisAction.details?.totalFindings}`,
      });
    }

    // Policy check
    const violationAction = audit.actions.find(a => a.action === "policy_violation");
    if (violationAction) {
      chain.push({
        step: 3,
        timestamp: violationAction.timestamp,
        event: "Policy violation detected",
        actor: "system",
        evidence: `Violations: ${violationAction.details?.violations?.join(", ")}`,
      });
    }

    // Execution or block
    if (audit.status === "rejected") {
      chain.push({
        step: chain.length + 1,
        timestamp: audit.endTime,
        event: "Execution blocked by policy",
        actor: "system",
        evidence: "Security policy enforcement",
      });
    } else {
      const completeAction = audit.actions.find(a => a.action === "execution_complete");
      if (completeAction) {
        chain.push({
          step: chain.length + 1,
          timestamp: completeAction.timestamp,
          event: "Execution completed",
          actor: "system",
          evidence: `Duration: ${completeAction.details?.duration_ms}ms`,
        });
      }
    }

    // Integrity verification
    chain.push({
      step: chain.length + 1,
      timestamp: new Date().toISOString(),
      event: "Audit report generated",
      actor: "system",
      evidence: `Report hash: ${crypto.createHash("sha256").update(JSON.stringify(audit)).digest("hex").substring(0, 16)}`,
    });

    return chain;
  }

  /**
   * Generate event timeline
   */
  _generateTimeline(audit) {
    const events = [];

    events.push({
      timestamp: audit.startTime,
      type: "start",
      description: "Execution started",
    });

    for (const action of audit.actions || []) {
      events.push({
        timestamp: action.timestamp,
        type: "action",
        description: action.action,
        details: action.details,
      });
    }

    for (const finding of audit.securityFindings || []) {
      events.push({
        timestamp: finding.timestamp,
        type: "security",
        severity: finding.severity,
        description: `${finding.category}: ${finding.description}`,
      });
    }

    if (audit.endTime) {
      events.push({
        timestamp: audit.endTime,
        type: "end",
        description: `Execution ${audit.status}`,
      });
    }

    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  _calculateRiskLevel(audit) {
    if (!audit.securityFindings || audit.securityFindings.length === 0) {
      return "safe";
    }
    const severities = audit.securityFindings.map(f => f.severity);
    if (severities.includes("critical")) return "critical";
    if (severities.includes("high")) return "high";
    if (severities.includes("medium")) return "medium";
    return "low";
  }

  _groupBySeverity(findings) {
    return findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {});
  }

  _groupByCategory(findings) {
    return findings.reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + 1;
      return acc;
    }, {});
  }

  _getBlockReason(audit) {
    const violation = audit.actions?.find(a => a.action === "policy_violation");
    return violation?.details?.violations?.join("; ") || null;
  }

  _getCodePreview(audit) {
    // Return first 200 chars of code for reference
    return null; // Code not stored in audit for security
  }

  _generateTamperProofHash(audit) {
    return crypto.createHash("sha256").update(JSON.stringify(audit)).digest("hex");
  }

  _getHighestSeverity(findings) {
    if (findings.some(f => f.severity === "critical")) return "critical";
    if (findings.some(f => f.severity === "high")) return "high";
    if (findings.some(f => f.severity === "medium")) return "medium";
    return "low";
  }

  _classifyIncident(audit) {
    const categories = audit.securityFindings.map(f => f.category);
    if (categories.includes("codeInjection")) return "code_injection_attempt";
    if (categories.includes("processSpawning")) return "privilege_escalation_attempt";
    if (categories.includes("networkExfiltration")) return "data_exfiltration_attempt";
    return "security_policy_violation";
  }

  _generateIncidentDescription(audit) {
    const findings = audit.securityFindings;
    const summary = findings.map(f => `${f.severity} ${f.category}`).join(", ");
    return `Security incident detected: ${summary}`;
  }

  _generateRecommendations(audit) {
    const recs = [];
    const categories = audit.securityFindings.map(f => f.category);

    if (categories.includes("codeInjection")) {
      recs.push("Review and sanitize all user inputs");
      recs.push("Implement Content Security Policy");
    }
    if (categories.includes("processSpawning")) {
      recs.push("Restrict child_process module access");
      recs.push("Enable syscall filtering");
    }
    if (categories.includes("networkExfiltration")) {
      recs.push("Implement egress filtering");
      recs.push("Monitor outbound connections");
    }

    return recs;
  }

  _extractIOCs(audit) {
    // Extract indicators of compromise
    const iocs = [];
    // This would parse findings for IPs, domains, file paths, etc.
    return iocs;
  }

  _mapToMITRE(findings) {
    // Map findings to MITRE ATT&CK techniques
    const mapping = {
      codeInjection: ["T1059", "T1064"],
      processSpawning: ["T1106", "T1059"],
      networkExfiltration: ["T1041", "T1048"],
      filesystemDestruction: ["T1485", "T1490"],
    };

    const techniques = new Set();
    for (const finding of findings) {
      const mapped = mapping[finding.category];
      if (mapped) {
        mapped.forEach(t => techniques.add(t));
      }
    }

    return Array.from(techniques);
  }

  _calculateRiskDistribution(reports) {
    return reports.reduce((acc, r) => {
      const level = r.summary.riskLevel;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
  }

  _toMarkdown(report) {
    return `# Execution Report: ${report.executionId}

## Summary
- **Status**: ${report.summary.status}
- **Risk Level**: ${report.summary.riskLevel}
- **Duration**: ${report.summary.durationMs}ms
- **Engine**: ${report.summary.engine}

## Security Analysis
- **Total Findings**: ${report.security.totalFindings}
- **Blocked**: ${report.security.wasBlocked ? "Yes" : "No"}

### Findings
${report.security.findings.map(f => `- **[${f.severity.toUpperCase()}]** ${f.category}: ${f.description}`).join("\n")}

## Chain of Custody
${report.chainOfCustody.map(c => `${c.step}. **${c.timestamp}** - ${c.event} (${c.actor})`).join("\n")}

## Timeline
${report.timeline.map(t => `- ${t.timestamp}: ${t.description}`).join("\n")}

---
Report ID: ${report.reportId} | Generated: ${report.generatedAt}
`;
  }

  _toHTML(report) {
    return `<!DOCTYPE html>
<html>
<head><title>Execution Report</title></head>
<body>
  <h1>Execution Report: ${report.executionId}</h1>
  <p>Status: ${report.summary.status}</p>
  <p>Risk Level: <span class="${report.summary.riskLevel}">${report.summary.riskLevel}</span></p>
  <h2>Security Findings (${report.security.totalFindings})</h2>
  <ul>
    ${report.security.findings.map(f => `<li class="${f.severity}">[${f.severity}] ${f.category}: ${f.description}</li>`).join("")}
  </ul>
</body>
</html>`;
  }

  _toCSV(report) {
    const headers = ["timestamp", "type", "severity", "description"];
    const rows = report.timeline.map(t => [t.timestamp, t.type, t.severity || "", t.description]);
    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }

  _toSIEMFormat(report) {
    // CEF (Common Event Format) for SIEM integration
    return `CEF:0|SandboxAI|Execution|1.0|${report.executionId}|${report.summary.status}|${report.summary.riskLevel === "safe" ? 0 : 5}|`;
  }
}

module.exports = { ReportGenerator };
