/**
 * SandboxAI Example: Advanced - Multi-Step Workflow Engine
 * Demonstrates dependency graphs, conditional execution, and error handling
 */

const http = require("node:http");

const workflowCode = `
// Advanced Workflow Engine with Dependencies
class WorkflowEngine {
  constructor() {
    this.workflows = new Map();
    this.executions = new Map();
  }

  // Define a workflow
  defineWorkflow(name, steps) {
    // Validate steps have unique IDs
    const ids = steps.map(s => s.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error("Duplicate step IDs");
    }

    // Build dependency graph
    const graph = this.buildDependencyGraph(steps);
    
    this.workflows.set(name, {
      name,
      steps,
      graph,
      createdAt: Date.now(),
    });
    
    return { name, steps: steps.length };
  }

  buildDependencyGraph(steps) {
    const graph = new Map();
    const stepMap = new Map(steps.map(s => [s.id, s]));

    for (const step of steps) {
      const deps = step.dependsOn || [];
      graph.set(step.id, {
        step,
        dependencies: deps,
        dependents: [],
      });
    }

    // Build reverse dependencies
    for (const [id, node] of graph) {
      for (const depId of node.dependencies) {
        if (!graph.has(depId)) {
          throw new Error(\`Step \${id} depends on unknown step \${depId}\`);
        }
        graph.get(depId).dependents.push(id);
      }
    }

    // Detect cycles
    this.detectCycles(graph);

    return graph;
  }

  detectCycles(graph) {
    const visited = new Set();
    const recStack = new Set();

    const dfs = (nodeId) => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const node = graph.get(nodeId);
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recStack.has(depId)) {
          throw new Error(\`Cycle detected involving step \${nodeId}\`);
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const [id] of graph) {
      if (!visited.has(id)) dfs(id);
    }
  }

  // Execute workflow
  async execute(workflowName, context = {}) {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) throw new Error(\`Workflow not found: \${workflowName}\`);

    const executionId = \`exec_\${Date.now()}\`;
    const execution = {
      id: executionId,
      workflow: workflowName,
      status: "running",
      context: { ...context },
      results: new Map(),
      stepStatus: new Map(),
      startTime: Date.now(),
      logs: [],
    };

    this.executions.set(executionId, execution);

    try {
      // Topological sort for execution order
      const order = this.topologicalSort(workflow.graph);
      
      // Execute steps in order
      for (const stepId of order) {
        await this.executeStep(execution, workflow.graph.get(stepId));
      }

      execution.status = "completed";
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;

    } catch (error) {
      execution.status = "failed";
      execution.error = error.message;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
    }

    return execution;
  }

  topologicalSort(graph) {
    const inDegree = new Map();
    for (const [id, node] of graph) {
      inDegree.set(id, node.dependencies.length);
    }

    const queue = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const result = [];
    while (queue.length > 0) {
      const id = queue.shift();
      result.push(id);

      const node = graph.get(id);
      for (const dependentId of node.dependents) {
        const newDegree = inDegree.get(dependentId) - 1;
        inDegree.set(dependentId, newDegree);
        if (newDegree === 0) queue.push(dependentId);
      }
    }

    if (result.length !== graph.size) {
      throw new Error("Cycle detected in workflow");
    }

    return result;
  }

  async executeStep(execution, node) {
    const step = node.step;
    const stepId = step.id;

    // Check if dependencies succeeded
    for (const depId of node.dependencies) {
      const depStatus = execution.stepStatus.get(depId);
      if (depStatus !== "completed") {
        execution.stepStatus.set(stepId, "skipped");
        execution.logs.push({ step: stepId, status: "skipped", reason: \`Dependency \${depId} not completed\` });
        return;
      }
    }

    // Check condition
    if (step.condition && !this.evaluateCondition(step.condition, execution)) {
      execution.stepStatus.set(stepId, "skipped");
      execution.logs.push({ step: stepId, status: "skipped", reason: "Condition not met" });
      return;
    }

    // Execute step
    execution.stepStatus.set(stepId, "running");
    execution.logs.push({ step: stepId, status: "started", time: Date.now() });

    try {
      const result = await this.runStepAction(step, execution);
      execution.results.set(stepId, result);
      execution.stepStatus.set(stepId, "completed");
      execution.logs.push({ step: stepId, status: "completed", result });
    } catch (error) {
      execution.stepStatus.set(stepId, "failed");
      execution.logs.push({ step: stepId, status: "failed", error: error.message });
      
      if (step.onError === "continue") {
        console.log(\`Step \${stepId} failed but continuing...\`);
      } else {
        throw error;
      }
    }
  }

  evaluateCondition(condition, execution) {
    // Simple condition evaluation
    const { field, operator, value } = condition;
    const actualValue = this.getValueFromPath(execution.context, field);
    
    switch(operator) {
      case "equals": return actualValue === value;
      case "notEquals": return actualValue !== value;
      case "greaterThan": return actualValue > value;
      case "lessThan": return actualValue < value;
      case "exists": return actualValue !== undefined;
      default: return true;
    }
  }

  getValueFromPath(obj, path) {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }

  async runStepAction(step, execution) {
    // Simulate step execution
    await this.delay(step.delay || 10);

    const actions = {
      fetch: () => ({ data: \`Fetched data for \${step.config?.url}\`, timestamp: Date.now() }),
      transform: () => {
        const input = execution.results.get(step.dependsOn?.[0]);
        return { transformed: true, input: input?.data };
      },
      validate: () => {
        const isValid = Math.random() > 0.1; // 90% success rate
        if (!isValid) throw new Error("Validation failed");
        return { valid: true, checks: ["format", "schema", "business_rules"] };
      },
      notify: () => ({ sent: true, channel: step.config?.channel, message: step.config?.message }),
      compute: () => {
        const result = step.config?.operation === "sum" 
          ? step.config.values.reduce((a,b) => a+b, 0)
          : step.config?.operation === "avg"
          ? step.config.values.reduce((a,b) => a+b, 0) / step.config.values.length
          : 0;
        return { operation: step.config?.operation, result };
      },
    };

    const action = actions[step.type];
    if (!action) throw new Error(\`Unknown step type: \${step.type}\`);
    
    return action();
  }

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  getExecution(executionId) {
    return this.executions.get(executionId);
  }
}

// Demo: ETL Pipeline Workflow
async function runETLDemo() {
  const engine = new WorkflowEngine();

  // Define ETL workflow
  const etlWorkflow = [
    {
      id: "extract",
      type: "fetch",
      config: { url: "https://api.example.com/data" },
    },
    {
      id: "validate",
      type: "validate",
      dependsOn: ["extract"],
    },
    {
      id: "transform",
      type: "transform",
      dependsOn: ["validate"],
    },
    {
      id: "enrich",
      type: "compute",
      dependsOn: ["transform"],
      config: { operation: "sum", values: [100, 200, 300] },
    },
    {
      id: "notify_success",
      type: "notify",
      dependsOn: ["enrich"],
      config: { channel: "email", message: "ETL completed successfully" },
      condition: { field: "notify", operator: "equals", value: true },
    },
  ];

  engine.defineWorkflow("etl_pipeline", etlWorkflow);

  console.log("=== Workflow Engine Demo: ETL Pipeline ===\\n");

  const result = await engine.execute("etl_pipeline", { notify: true });
  
  console.log("Execution ID:", result.id);
  console.log("Status:", result.status);
  console.log("Duration:", result.duration, "ms");
  console.log("\\nStep Results:");
  
  for (const [stepId, status] of result.stepStatus) {
    const stepResult = result.results.get(stepId);
    console.log(\`  \${stepId}: \${status}\`, stepResult ? JSON.stringify(stepResult) : "");
  }

  return result;
}

// Demo: Conditional Workflow
async function runConditionalDemo() {
  const engine = new WorkflowEngine();

  const conditionalWorkflow = [
    { id: "check_input", type: "validate" },
    { 
      id: "process_premium", 
      type: "compute",
      dependsOn: ["check_input"],
      condition: { field: "userType", operator: "equals", value: "premium" },
      config: { operation: "sum", values: [1000, 2000] },
    },
    { 
      id: "process_basic", 
      type: "compute",
      dependsOn: ["check_input"],
      condition: { field: "userType", operator: "equals", value: "basic" },
      config: { operation: "sum", values: [100, 200] },
    },
    { id: "notify", type: "notify", dependsOn: ["process_premium", "process_basic"], onError: "continue" },
  ];

  engine.defineWorkflow("conditional", conditionalWorkflow);

  console.log("\\n=== Conditional Workflow (Premium User) ===");
  const result1 = await engine.execute("conditional", { userType: "premium" });
  console.log("Status:", result1.status);
  console.log("Steps:", Array.from(result1.stepStatus.entries()).map(([k,v]) => \`\${k}=\${v}\`).join(", "));

  console.log("\\n=== Conditional Workflow (Basic User) ===");
  const result2 = await engine.execute("conditional", { userType: "basic" });
  console.log("Status:", result2.status);
  console.log("Steps:", Array.from(result2.stepStatus.entries()).map(([k,v]) => \`\${k}=\${v}\`).join(", "));
}

// Run demos
async function main() {
  await runETLDemo();
  await runConditionalDemo();
  console.log("\\n✅ Workflow demos complete!");
}

main().catch(console.error);
`;

async function runExample() {
  console.log("=== SandboxAI: Workflow Engine ===\\n");

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
      res.on("end", () => {
        const result = JSON.parse(data);
        console.log(result.output);
        resolve(result);
      });
    });

    req.on("error", reject);

    req.write(JSON.stringify({
      code: workflowCode,
      engine: "v8",
      policy: "agent",
      timeout: 30000,
      context: "Workflow engine with dependencies"
    }));

    req.end();
  });
}

http.get("http://localhost:3000/api/stats", () => {
  runExample().catch(console.error);
}).on("error", () => {
  console.error("❌ Server not running");
});
