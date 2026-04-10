/**
 * SandboxAI Example: Advanced - AI Agent with Tool Use
 * Simulates an AI agent that can use tools, maintain state, and make decisions
 */

const http = require("node:http");

const aiAgentCode = `
// Advanced AI Agent with Tool Use
class AIAgent {
  constructor() {
    this.tools = {
      calculator: this.calculator.bind(this),
      search: this.search.bind(this),
      datetime: this.datetime.bind(this),
      memory: this.memory.bind(this),
      analyze: this.analyze.bind(this),
    };
    this.memory = new Map();
    this.conversationHistory = [];
  }

  // Tool: Calculator
  calculator(operation, a, b) {
    const ops = {
      add: (x, y) => x + y,
      subtract: (x, y) => x - y,
      multiply: (x, y) => x * y,
      divide: (x, y) => x / y,
      power: (x, y) => Math.pow(x, y),
      sqrt: (x) => Math.sqrt(x),
    };
    
    if (!ops[operation]) throw new Error(\`Unknown operation: \${operation}\`);
    const result = b !== undefined ? ops[operation](a, b) : ops[operation](a);
    return { operation, result, inputs: { a, b } };
  }

  // Tool: Search (simulated)
  search(query) {
    const database = {
      "javascript": "A high-level programming language",
      "nodejs": "JavaScript runtime built on Chrome's V8 engine",
      "sandbox": "Isolated environment for secure code execution",
      "wasm": "WebAssembly - binary instruction format",
      "security": "Protection against threats and vulnerabilities",
    };
    
    const results = Object.entries(database)
      .filter(([k]) => k.includes(query.toLowerCase()))
      .map(([k, v]) => ({ term: k, definition: v }));
    
    return { query, results, count: results.length };
  }

  // Tool: DateTime
  datetime(format = "iso") {
    const now = new Date();
    const formats = {
      iso: now.toISOString(),
      unix: now.getTime(),
      local: now.toLocaleString(),
      date: now.toDateString(),
      time: now.toTimeString(),
    };
    return { now: formats[format] || formats.iso, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  // Tool: Memory
  memory(action, key, value) {
    switch(action) {
      case "set":
        this.memory.set(key, { value, timestamp: Date.now() });
        return { action, key, status: "stored" };
      case "get":
        const item = this.memory.get(key);
        return { action, key, found: !!item, value: item?.value };
      case "list":
        return { action, keys: Array.from(this.memory.keys()) };
      case "clear":
        this.memory.clear();
        return { action, status: "cleared" };
      default:
        throw new Error(\`Unknown memory action: \${action}\`);
    }
  }

  // Tool: Data Analysis
  analyze(data, type) {
    const nums = data.filter(x => typeof x === 'number');
    
    switch(type) {
      case "stats":
        const sum = nums.reduce((a, b) => a + b, 0);
        const avg = sum / nums.length;
        const sorted = [...nums].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        return { type, count: nums.length, sum, avg, median, min, max };
      
      case "frequency":
        const freq = {};
        data.forEach(x => { freq[x] = (freq[x] || 0) + 1; });
        return { type, frequency: freq };
      
      case "trend":
        // Simple trend detection
        let increasing = 0, decreasing = 0;
        for (let i = 1; i < nums.length; i++) {
          if (nums[i] > nums[i-1]) increasing++;
          else if (nums[i] < nums[i-1]) decreasing++;
        }
        const trend = increasing > decreasing ? "up" : decreasing > increasing ? "down" : "flat";
        return { type, trend, increasing, decreasing };
      
      default:
        throw new Error(\`Unknown analysis type: \${type}\`);
    }
  }

  // Parse and execute tool calls from "natural language"
  async processRequest(request) {
    this.conversationHistory.push({ role: "user", content: request, timestamp: Date.now() });
    
    // Simple intent parsing (in real AI, this would use NLP)
    const intent = this.parseIntent(request);
    
    let response;
    try {
      const toolResult = await this.executeTool(intent);
      response = {
        success: true,
        intent: intent.tool,
        result: toolResult,
        explanation: this.generateExplanation(intent, toolResult),
      };
    } catch (error) {
      response = {
        success: false,
        error: error.message,
        suggestion: "Try: calculator add 5 3, or search javascript",
      };
    }
    
    this.conversationHistory.push({ role: "assistant", content: response, timestamp: Date.now() });
    return response;
  }

  parseIntent(request) {
    const lower = request.toLowerCase();
    
    // Calculator patterns
    const calcMatch = lower.match(/(add|subtract|multiply|divide|power|sqrt)\\s+(\\d+(?:\\.\\d+)?)(?:\\s+(\\d+(?:\\.\\d+)?))?/);
    if (calcMatch) {
      return {
        tool: "calculator",
        operation: calcMatch[1],
        a: parseFloat(calcMatch[2]),
        b: calcMatch[3] ? parseFloat(calcMatch[3]) : undefined,
      };
    }
    
    // Search pattern
    const searchMatch = lower.match(/search\\s+for?\\s+(.+)/);
    if (searchMatch) {
      return { tool: "search", query: searchMatch[1].trim() };
    }
    
    // DateTime patterns
    if (lower.includes("time") || lower.includes("date")) {
      const format = lower.includes("unix") ? "unix" : 
                     lower.includes("local") ? "local" : "iso";
      return { tool: "datetime", format };
    }
    
    // Memory patterns
    const memSetMatch = lower.match(/remember\\s+(.+?)\\s+is\\s+(.+)/);
    if (memSetMatch) {
      return { tool: "memory", action: "set", key: memSetMatch[1].trim(), value: memSetMatch[2].trim() };
    }
    const memGetMatch = lower.match(/what\\s+is\\s+(.+)|recall\\s+(.+)/);
    if (memGetMatch) {
      return { tool: "memory", action: "get", key: (memGetMatch[1] || memGetMatch[2]).trim() };
    }
    
    // Analysis pattern
    const analyzeMatch = lower.match(/analyze\\s+(\\[.+\\])\\s+for\\s+(stats|frequency|trend)/);
    if (analyzeMatch) {
      return { tool: "analyze", data: JSON.parse(analyzeMatch[1]), type: analyzeMatch[2] };
    }
    
    throw new Error("Could not understand request");
  }

  async executeTool(intent) {
    const tool = this.tools[intent.tool];
    if (!tool) throw new Error(\`Tool not found: \${intent.tool}\`);
    
    // Remove tool name from params
    const { tool: _, ...params } = intent;
    return tool(...Object.values(params));
  }

  generateExplanation(intent, result) {
    const explanations = {
      calculator: () => \`I calculated \${intent.operation} of \${intent.a}\${intent.b !== undefined ? ' and ' + intent.b : ''}, which equals \${result.result}\`,
      search: () => \`I found \${result.count} result(s) for "\${intent.query}"\`,
      datetime: () => \`The current date/time is \${result.now}\`,
      memory: () => intent.action === "set" ? \`I remembered that \${intent.key} is \${intent.value}\` : \`I recalled: \${result.value}\`,
      analyze: () => \`I analyzed the data and found: \${JSON.stringify(result)}\`,
    };
    
    return explanations[intent.tool]?.() || "Task completed";
  }

  getConversationHistory() {
    return this.conversationHistory;
  }
}

// Demo
async function runDemo() {
  const agent = new AIAgent();
  const requests = [
    "add 15 27",
    "multiply 8 6",
    "search for javascript",
    "what time is it",
    "remember userName is Alice",
    "what is userName",
    "analyze [1,2,3,4,5,6,7,8,9,10] for stats",
    "analyze [1,2,3,4,5,4,3,2,1] for trend",
  ];

  console.log("=== AI Agent Demo ===\\n");

  for (const request of requests) {
    console.log(\`User: "\${request}"\`);
    const response = await agent.processRequest(request);
    console.log(\`Agent: \${response.explanation || response.suggestion || JSON.stringify(response.result)}\`);
    console.log("");
  }

  console.log("\\n=== Conversation History ===");
  console.log(\`Total exchanges: \${agent.getConversationHistory().length / 2}\`);
}

runDemo().catch(console.error);
`;

async function runExample() {
  console.log("=== SandboxAI: Advanced AI Agent ===\\n");

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
      code: aiAgentCode,
      engine: "v8",
      policy: "agent",
      timeout: 30000,
      context: "AI agent with tool use"
    }));

    req.end();
  });
}

http.get("http://localhost:3000/api/stats", () => {
  runExample().catch(console.error);
}).on("error", () => {
  console.error("❌ Server not running");
});
