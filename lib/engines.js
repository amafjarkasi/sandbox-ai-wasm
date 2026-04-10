/**
 * SandboxAI - Engine Manager
 * Manages multiple JavaScript engines (V8, JSC, QuickJS, etc.)
 */

const ENGINES = {
  v8: {
    name: "V8",
    description: "Google's high-performance JavaScript engine",
    version: "12.0",
    features: ["JIT", "WebAssembly", "ES2024"],
    bestFor: ["heavy computation", "complex apps"],
    coldStartMs: 5,
    available: true,
  },
  jsc: {
    name: "JavaScriptCore",
    description: "WebKit's JavaScript engine",
    version: "17.0",
    features: ["JIT", "ES2024", "iOS compatible"],
    bestFor: ["Safari-like environments", "iOS apps"],
    coldStartMs: 8,
    available: true,
  },
  quickjs: {
    name: "QuickJS",
    description: "Lightweight embeddable JS engine",
    version: "2024-01-13",
    features: ["Small footprint", "ES2020", "No JIT"],
    bestFor: ["embedded", "low memory", "quick scripts"],
    coldStartMs: 2,
    available: true,
  },
  spidermonkey: {
    name: "SpiderMonkey",
    description: "Mozilla's JavaScript engine",
    version: "115",
    features: ["JIT", "ES2024", "Firefox compatible"],
    bestFor: ["Firefox-like environments"],
    coldStartMs: 10,
    available: false,
  },
  hermes: {
    name: "Hermes",
    description: "Facebook's React Native engine",
    version: "0.12",
    features: ["AOT compilation", "Small bundle size"],
    bestFor: ["React Native", "mobile apps"],
    coldStartMs: 3,
    available: false,
  },
};

class EngineManager {
  constructor() {
    this.engines = { ...ENGINES };
    this.usage = { v8: 0, jsc: 0, quickjs: 0, spidermonkey: 0, hermes: 0 };
  }

  /**
   * List all available engines
   */
  listEngines() {
    return Object.entries(this.engines).map(([id, engine]) => ({
      id,
      ...engine,
    }));
  }

  /**
   * Get a specific engine
   */
  getEngine(id) {
    return this.engines[id] || this.engines.v8;
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      engines: Object.entries(this.engines).map(([id, engine]) => ({
        id,
        name: engine.name,
        available: engine.available,
        coldStartMs: engine.coldStartMs,
        usage: this.usage[id] || 0,
      })),
      totalUsage: Object.values(this.usage).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Record engine usage
   */
  recordUsage(engineId) {
    this.usage[engineId] = (this.usage[engineId] || 0) + 1;
  }

  /**
   * Recommend an engine based on code characteristics
   */
  recommendEngine(code) {
    const lines = code.split("\n").length;
    const hasAsync = /async|await|Promise/.test(code);
    const hasHeavyMath = /Math\.|BigInt|Array\.from\(\{length/.test(code);

    if (lines < 50 && !hasHeavyMath) {
      return "quickjs";
    }
    if (hasAsync) {
      return "v8";
    }
    return "v8";
  }
}

module.exports = { EngineManager, ENGINES };
