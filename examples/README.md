# SandboxAI Examples

A collection of examples demonstrating SandboxAI capabilities from basic to advanced.

## Quick Start

```bash
# Start the server
node server.js

# Run any example
node examples/quick-run.js
node examples/moderate-data-processing.js
node examples/advanced-ai-agent.js
```

## Example Categories

### Basic Examples

| Example | Description | Concepts |
|---------|-------------|----------|
| `quick-run.js` | Simple code execution | Basic API usage |
| `ai-agent.js` | MCP tool integration | Agent interface |
| `data-pipeline.js` | SSE streaming | Real-time output |

### Moderate Examples

| Example | Description | Concepts |
|---------|-------------|----------|
| `moderate-data-processing.js` | CSV parsing & analysis | Data transformation, aggregation |
| `moderate-api-mocking.js` | Mock API server & tests | Async operations, test patterns |

**Features demonstrated:**
- CSV parsing and statistical analysis
- Data transformation pipelines
- Mock API with CRUD operations
- Automated test suites
- Correlation analysis

### Advanced Examples

| Example | Description | Concepts |
|---------|-------------|----------|
| `advanced-ai-agent.js` | AI agent with tool use | Intent parsing, memory, state |
| `advanced-workflow-engine.js` | Multi-step workflows | Dependency graphs, DAG execution |

**Features demonstrated:**
- Natural language intent parsing
- Tool registry pattern
- Conversation history
- Workflow definition DSL
- Topological sorting
- Conditional execution
- Error handling strategies

### Complex Examples

| Example | Description | Concepts |
|---------|-------------|----------|
| `complex-parallel-execution.js` | Worker pools & batching | Concurrency, MapReduce |
| `complex-streaming-pipeline.js` | Real-time stream processing | Backpressure, windowing |

**Features demonstrated:**
- Worker pool pattern
- Batch processing with retry
- MapReduce implementation
- Stream processing with backpressure
- Tumbling/sliding/session windows
- Real-time aggregation
- Pipeline composition

### Security Examples

| Example | Description | Concepts |
|---------|-------------|----------|
| `dangerous-scripts.js` | Attack vector detection | Security analysis, auditing |

**Features demonstrated:**
- 11 categories of threat detection
- Risk scoring
- Policy enforcement
- Audit trail generation

## Running Examples

### Basic Usage

```bash
node examples/quick-run.js
```

### With Different Engines

```javascript
// In any example, change the engine:
{
  code: yourCode,
  engine: "v8",      // Default, fastest
  engine: "jsc",     // JavaScriptCore
  engine: "quickjs"  // Lightweight
}
```

### With Different Policies

```javascript
// Strict - most secure
{ policy: "strict" }

// Standard - balanced
{ policy: "standard" }

// Extended - more permissions
{ policy: "extended" }

// Agent - for AI workloads
{ policy: "agent" }
```

## Example Output

### Data Processing Example
```
=== Department Statistics ===
{
  "Engineering": { "count": 5, "avgSalary": 98400, "avgAge": 36 },
  "Marketing": { "count": 3, "avgSalary": 74666, "avgAge": 30 },
  "Sales": { "count": 2, "avgSalary": 91500, "avgAge": 38 }
}

=== Salary Percentiles ===
{ "p50": 85000, "p75": 95000, "p90": 110000 }

=== Age-Salary Correlation ===
{ "correlation": "0.4523", "interpretation": "Positive" }
```

### AI Agent Example
```
User: "add 15 27"
Agent: I calculated add of 15 and 27, which equals 42

User: "search for javascript"
Agent: I found 1 result(s) for "javascript"

User: "remember userName is Alice"
Agent: I remembered that userName is Alice
```

### Workflow Engine Example
```
Execution ID: exec_1234567890
Status: completed
Duration: 156 ms

Step Results:
  extract: completed {"data": "Fetched data..."}
  validate: completed {"valid": true}
  transform: completed {"transformed": true}
  enrich: completed {"result": 600}
  notify_success: completed {"sent": true}
```

### Parallel Execution Example
```
Processing 12 tasks, batch size 4
Processing batch 1/3...
Processing batch 2/3...
Processing batch 3/3...

=== Results ===
Duration: 245 ms
Summary: {
  "total": 12,
  "successful": 12,
  "failed": 0,
  "successRate": "100.00%"
}
```

## Creating Custom Examples

Template for new examples:

```javascript
const http = require("node:http");

const myCode = `
// Your code here
console.log("Hello from sandbox!");
`;

async function runExample() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "localhost",
      port: 3000,
      path: "/api/execute",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(JSON.parse(data)));
    });

    req.on("error", reject);
    req.write(JSON.stringify({
      code: myCode,
      engine: "v8",
      policy: "standard"
    }));
    req.end();
  });
}

http.get("http://localhost:3000/api/stats", () => {
  runExample().catch(console.error);
});
```

## Tips

1. **Use appropriate policies** - Strict for untrusted code, Agent for AI workloads
2. **Set timeouts** - Long-running examples need higher timeout values
3. **Check risk scores** - Examples show how to access danger analysis
4. **Stream for real-time** - Use `/api/execute/stream` for live output
5. **Audit everything** - All executions are logged for security review
