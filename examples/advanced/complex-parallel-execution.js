/**
 * SandboxAI Example: Complex - Parallel Execution with Worker Pools
 * Demonstrates concurrent task processing, load balancing, and result aggregation
 */

const http = require("node:http");

const parallelCode = `
// Advanced Parallel Execution Engine
class ParallelExecutor {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 4;
    this.taskQueue = [];
    this.running = new Map();
    this.results = new Map();
    this.stats = {
      totalTasks: 0,
      completed: 0,
      failed: 0,
      retried: 0,
    };
  }

  // Worker Pool Pattern
  async executeParallel(tasks, options = {}) {
    const { batchSize = this.maxConcurrency, retryAttempts = 0 } = options;
    
    console.log(\`Starting parallel execution: \${tasks.length} tasks, batch size \${batchSize}\`);
    
    const batches = this.createBatches(tasks, batchSize);
    const allResults = [];

    for (let i = 0; i < batches.length; i++) {
      console.log(\`Processing batch \${i + 1}/\${batches.length}...\`);
      const batchResults = await this.executeBatch(batches[i], retryAttempts);
      allResults.push(...batchResults);
    }

    return {
      results: allResults,
      stats: { ...this.stats },
      summary: this.generateSummary(allResults),
    };
  }

  createBatches(tasks, size) {
    const batches = [];
    for (let i = 0; i < tasks.length; i += size) {
      batches.push(tasks.slice(i, i + size));
    }
    return batches;
  }

  async executeBatch(batch, retryAttempts) {
    const promises = batch.map(task => this.executeTaskWithRetry(task, retryAttempts));
    return Promise.all(promises);
  }

  async executeTaskWithRetry(task, maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeTask(task);
        this.stats.completed++;
        return { task: task.id, status: "success", result, attempts: attempt + 1 };
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          this.stats.retried++;
          await this.delay(Math.pow(2, attempt) * 100); // Exponential backoff
        }
      }
    }
    
    this.stats.failed++;
    return { task: task.id, status: "failed", error: lastError.message, attempts: maxRetries + 1 };
  }

  async executeTask(task) {
    this.stats.totalTasks++;
    const startTime = Date.now();
    
    // Simulate different task types
    switch(task.type) {
      case "compute":
        return this.computeTask(task.payload);
      case "io":
        return this.ioTask(task.payload);
      case "transform":
        return this.transformTask(task.payload);
      case "validate":
        return this.validateTask(task.payload);
      default:
        throw new Error(\`Unknown task type: \${task.type}\`);
    }
  }

  computeTask(payload) {
    // CPU-intensive task
    const { operation, values } = payload;
    let result;
    
    switch(operation) {
      case "fibonacci":
        result = this.fibonacci(values.n);
        break;
      case "factorial":
        result = this.factorial(values.n);
        break;
      case "primes":
        result = this.findPrimes(values.max);
        break;
      case "matrix":
        result = this.matrixMultiply(values.a, values.b);
        break;
      default:
        throw new Error(\`Unknown operation: \${operation}\`);
    }
    
    return { operation, result, computedAt: Date.now() };
  }

  ioTask(payload) {
    // Simulate I/O operation
    const { resource, delay } = payload;
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ 
          resource, 
          data: \`Data from \${resource}\`,
          latency: delay,
          timestamp: Date.now()
        });
      }, delay);
    });
  }

  transformTask(payload) {
    // Data transformation
    const { data, operations } = payload;
    let result = [...data];
    
    for (const op of operations) {
      switch(op) {
        case "sort":
          result.sort((a, b) => a - b);
          break;
        case "filter":
          result = result.filter(x => x > payload.filterThreshold);
          break;
        case "map":
          result = result.map(x => x * (payload.multiplier || 1));
          break;
        case "reduce":
          result = [result.reduce((a, b) => a + b, 0)];
          break;
      }
    }
    
    return { originalSize: data.length, resultSize: result.length, result };
  }

  validateTask(payload) {
    // Validation task
    const { data, schema } = payload;
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && (value === undefined || value === null)) {
        errors.push(\`\${field} is required\`);
      }
      if (rules.type && typeof value !== rules.type) {
        errors.push(\`\${field} must be \${rules.type}\`);
      }
      if (rules.min !== undefined && value < rules.min) {
        errors.push(\`\${field} must be >= \${rules.min}\`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(\`\${field} must be <= \${rules.max}\`);
      }
    }
    
    return { valid: errors.length === 0, errors, fieldCount: Object.keys(data).length };
  }

  // Math utilities
  fibonacci(n) {
    if (n < 2) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  factorial(n) {
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  findPrimes(max) {
    const primes = [];
    for (let i = 2; i <= max; i++) {
      if (primes.every(p => i % p !== 0)) primes.push(i);
    }
    return primes;
  }

  matrixMultiply(a, b) {
    const result = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < a[0].length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  generateSummary(results) {
    const successful = results.filter(r => r.status === "success");
    const failed = results.filter(r => r.status === "failed");
    
    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: ((successful.length / results.length) * 100).toFixed(2) + "%",
      avgAttempts: (results.reduce((s, r) => s + r.attempts, 0) / results.length).toFixed(2),
    };
  }

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

// Demo: Mixed Workload
async function runMixedWorkloadDemo() {
  console.log("=== Parallel Execution: Mixed Workload ===\\n");
  
  const executor = new ParallelExecutor({ maxConcurrency: 4 });
  
  // Create diverse tasks
  const tasks = [
    // Computation tasks
    { id: "fib-35", type: "compute", payload: { operation: "fibonacci", values: { n: 35 } } },
    { id: "fib-30", type: "compute", payload: { operation: "fibonacci", values: { n: 30 } } },
    { id: "fact-20", type: "compute", payload: { operation: "factorial", values: { n: 20 } } },
    { id: "primes-1000", type: "compute", payload: { operation: "primes", values: { max: 1000 } } },
    
    // I/O tasks (simulated)
    { id: "io-1", type: "io", payload: { resource: "database", delay: 50 } },
    { id: "io-2", type: "io", payload: { resource: "api", delay: 80 } },
    { id: "io-3", type: "io", payload: { resource: "cache", delay: 20 } },
    { id: "io-4", type: "io", payload: { resource: "filesystem", delay: 100 } },
    
    // Transform tasks
    { id: "transform-1", type: "transform", payload: { data: [5,2,8,1,9,3], operations: ["sort"] } },
    { id: "transform-2", type: "transform", payload: { data: [1,2,3,4,5], operations: ["map"], multiplier: 10 } },
    { id: "transform-3", type: "transform", payload: { data: [10,20,30,40,50], operations: ["filter"], filterThreshold: 25 } },
    
    // Validation tasks
    { id: "validate-1", type: "validate", payload: { 
      data: { name: "Alice", age: 30, email: "alice@example.com" },
      schema: { name: { required: true, type: "string" }, age: { required: true, type: "number", min: 0, max: 150 } }
    }},
    { id: "validate-2", type: "validate", payload: {
      data: { name: "", age: -5 },
      schema: { name: { required: true }, age: { min: 0 } }
    }},
  ];
  
  const startTime = Date.now();
  const result = await executor.executeParallel(tasks, { batchSize: 4, retryAttempts: 1 });
  const duration = Date.now() - startTime;
  
  console.log("\\n=== Results ===");
  console.log("Duration:", duration, "ms");
  console.log("Summary:", result.summary);
  
  console.log("\\n=== Task Results ===");
  for (const r of result.results) {
    const icon = r.status === "success" ? "✓" : "✗";
    console.log(\`\${icon} \${r.task}: \${r.status} (attempts: \${r.attempts})\`);
    if (r.result) {
      const resultStr = typeof r.result === "object" 
        ? JSON.stringify(r.result).substring(0, 80) + "..."
        : r.result;
      console.log(\`   → \${resultStr}\`);
    }
    if (r.error) console.log(\`   → Error: \${r.error}\`);
  }
  
  return result;
}

// Demo: MapReduce Pattern
async function runMapReduceDemo() {
  console.log("\\n\\n=== MapReduce Pattern ===\\n");
  
  const executor = new ParallelExecutor({ maxConcurrency: 4 });
  
  // Large dataset
  const dataset = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    category: ["A", "B", "C", "D"][i % 4],
    value: Math.floor(Math.random() * 100),
    tags: ["tag1", "tag2", "tag3"].slice(0, (i % 3) + 1),
  }));
  
  console.log(\`Processing \${dataset.length} records...\`);
  
  // Map phase: Process chunks in parallel
  const chunkSize = 250;
  const chunks = [];
  for (let i = 0; i < dataset.length; i += chunkSize) {
    chunks.push(dataset.slice(i, i + chunkSize));
  }
  
  const mapTasks = chunks.map((chunk, idx) => ({
    id: \`map-\${idx}\`,
    type: "transform",
    payload: {
      data: chunk,
      operations: ["reduce"],
    },
  }));
  
  // Execute map phase
  const mapResult = await executor.executeParallel(mapTasks, { batchSize: 4 });
  
  // Reduce phase: Aggregate results
  const mappedValues = mapResult.results
    .filter(r => r.status === "success")
    .map(r => r.result.result[0]);
  
  const finalSum = mappedValues.reduce((a, b) => a + b, 0);
  
  console.log("\\nMapReduce Results:");
  console.log("  Chunks processed:", mapResult.results.length);
  console.log("  Intermediate sums:", mappedValues.slice(0, 5).join(", "), "...");
  console.log("  Final sum:", finalSum);
  console.log("  Average per record:", (finalSum / dataset.length).toFixed(2));
}

// Run demos
async function main() {
  await runMixedWorkloadDemo();
  await runMapReduceDemo();
  console.log("\\n✅ Parallel execution demos complete!");
}

main().catch(console.error);
`;

async function runExample() {
  console.log("=== SandboxAI: Parallel Execution ===\\n");

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
      code: parallelCode,
      engine: "v8",
      policy: "agent",
      timeout: 60000,
      context: "Parallel execution with worker pools"
    }));

    req.end();
  });
}

http.get("http://localhost:3000/api/stats", () => {
  runExample().catch(console.error);
}).on("error", () => {
  console.error("❌ Server not running");
});
