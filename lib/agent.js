/**
 * SandboxAI - MCP Agent Server
 * Model Context Protocol compatible tool interface for AI agents
 */

class AgentServer {
  constructor({ executor, policyEngine }) {
    this.executor = executor;
    this.policyEngine = policyEngine;
    this.tools = this._defineTools();
  }

  /**
   * Define available MCP tools
   */
  _defineTools() {
    return {
      execute: {
        name: "execute",
        description: "Execute JavaScript code in a secure sandbox",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "JavaScript code to execute"
            },
            engine: {
              type: "string",
              enum: ["v8", "jsc", "quickjs"],
              description: "JavaScript engine to use",
              default: "v8"
            },
            timeout: {
              type: "number",
              description: "Execution timeout in milliseconds",
              default: 30000
            },
            policy: {
              type: "string",
              enum: ["strict", "standard", "extended", "agent"],
              description: "Security policy to apply",
              default: "agent"
            },
            context: {
              type: "string",
              description: "Context for the execution (e.g., purpose, source)"
            }
          },
          required: ["code"]
        },
        returns: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string" },
            output: { type: "string" },
            error: { type: "string" },
            duration_ms: { type: "number" },
            engine: { type: "string" }
          }
        }
      },
      validate: {
        name: "validate",
        description: "Validate a security policy configuration",
        inputSchema: {
          type: "object",
          properties: {
            policy: {
              type: "object",
              description: "Policy configuration to validate"
            }
          },
          required: ["policy"]
        }
      },
      analyze: {
        name: "analyze",
        description: "Analyze code for security violations without executing",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Code to analyze"
            },
            policy: {
              type: "string",
              description: "Policy to check against",
              default: "standard"
            }
          },
          required: ["code"]
        }
      },
      getStats: {
        name: "getStats",
        description: "Get platform statistics and engine status",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    };
  }

  /**
   * List all available tools
   */
  listTools() {
    return {
      tools: Object.values(this.tools).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  }

  /**
   * Handle a tool call
   */
  async handleToolCall(toolName, params) {
    const tool = this.tools[toolName];
    if (!tool) {
      return {
        error: `Unknown tool: ${toolName}`,
        available_tools: Object.keys(this.tools)
      };
    }

    try {
      switch (toolName) {
        case "execute":
          return await this._handleExecute(params);
        case "validate":
          return this._handleValidate(params);
        case "analyze":
          return this._handleAnalyze(params);
        case "getStats":
          return this._handleGetStats();
        default:
          return { error: "Tool not implemented" };
      }
    } catch (err) {
      return {
        error: err.message,
        tool: toolName
      };
    }
  }

  /**
   * Handle execute tool
   */
  async _handleExecute(params) {
    const { code, engine = "v8", timeout, policy = "agent", context } = params;

    if (!code) {
      return { error: "Missing required parameter: code" };
    }

    const result = await this.executor.execute({
      code,
      engine,
      timeout,
      policy,
      context,
      language: "javascript"
    });

    return {
      content: [
        {
          type: "text",
          text: result.status === "completed"
            ? `Execution completed in ${result.duration_ms}ms\\n\\nOutput:\\n${result.output}`
            : `Execution ${result.status}: ${result.error || result.violations?.join(", ")}`
        }
      ],
      isError: result.status !== "completed",
      result
    };
  }

  /**
   * Handle validate tool
   */
  _handleValidate(params) {
    const { policy } = params;
    const validation = this.policyEngine.validate(policy);

    return {
      content: [
        {
          type: "text",
          text: validation.valid
            ? `Policy is valid. Warnings: ${validation.warnings.length > 0 ? validation.warnings.join(", ") : "none"}`
            : `Policy is invalid. Errors: ${validation.errors.join(", ")}`
        }
      ],
      validation
    };
  }

  /**
   * Handle analyze tool
   */
  _handleAnalyze(params) {
    const { code, policy = "standard" } = params;

    if (!code) {
      return { error: "Missing required parameter: code" };
    }

    const check = this.policyEngine.checkCode(code, policy);

    return {
      content: [
        {
          type: "text",
          text: check.allowed
            ? "Code passes all policy checks."
            : `Code violates policy: ${check.violations.join("; ")}`
        }
      ],
      analysis: check
    };
  }

  /**
   * Handle getStats tool
   */
  _handleGetStats() {
    return {
      content: [
        {
          type: "text",
          text: "Platform statistics retrieved successfully."
        }
      ],
      stats: {
        message: "Use /api/stats endpoint for full statistics"
      }
    };
  }
}

module.exports = { AgentServer };
