/**
 * SandboxAI Example: Complex - Real-time Streaming Pipeline
 * Demonstrates backpressure handling, windowing, and stream processing
 */

const http = require("node:http");

const streamingCode = `
// Advanced Streaming Pipeline with Backpressure
class StreamingPipeline {
  constructor(options = {}) {
    this.bufferSize = options.bufferSize || 100;
    this.windowSize = options.windowSize || 10;
    this.windowSlide = options.windowSlide || 5;
    this.processors = [];
    this.sinks = [];
    this.metrics = {
      received: 0,
      processed: 0,
      dropped: 0,
      errors: 0,
    };
  }

  // Add a processor to the pipeline
  pipe(processor) {
    this.processors.push(processor);
    return this;
  }

  // Add a sink (final destination)
  to(sink) {
    this.sinks.push(sink);
    return this;
  }

  // Process a single event through the pipeline
  async process(event) {
    this.metrics.received++;
    
    try {
      let data = event;
      
      // Run through all processors
      for (const processor of this.processors) {
        data = await processor(data);
        if (data === null || data === undefined) {
          this.metrics.dropped++;
          return null; // Filtered out
        }
      }
      
      // Send to all sinks
      for (const sink of this.sinks) {
        await sink(data);
      }
      
      this.metrics.processed++;
      return data;
      
    } catch (error) {
      this.metrics.errors++;
      console.error("Pipeline error:", error.message);
      throw error;
    }
  }

  // Process a stream of events
  async processStream(events, options = {}) {
    const { onProgress, batchSize = 10 } = options;
    const results = [];
    
    for (let i = 0; i < events.length; i++) {
      const result = await this.process(events[i]);
      if (result) results.push(result);
      
      if (onProgress && (i + 1) % batchSize === 0) {
        onProgress({ processed: i + 1, total: events.length });
      }
      
      // Simulate backpressure
      if (this.metrics.received - this.metrics.processed > this.bufferSize) {
        console.log("⚠️  Backpressure detected, throttling...");
        await this.delay(10);
      }
    }
    
    return results;
  }

  // Windowed stream processing
  async processWindowed(events, windowType = "tumbling") {
    const windows = [];
    
    if (windowType === "tumbling") {
      // Non-overlapping windows
      for (let i = 0; i < events.length; i += this.windowSize) {
        windows.push(events.slice(i, i + this.windowSize));
      }
    } else if (windowType === "sliding") {
      // Overlapping windows
      for (let i = 0; i <= events.length - this.windowSize; i += this.windowSlide) {
        windows.push(events.slice(i, i + this.windowSize));
      }
    } else if (windowType === "session") {
      // Session windows based on gaps
      let currentWindow = [events[0]];
      const gapThreshold = 1000; // 1 second gap
      
      for (let i = 1; i < events.length; i++) {
        const gap = events[i].timestamp - events[i-1].timestamp;
        if (gap > gapThreshold) {
          windows.push(currentWindow);
          currentWindow = [events[i]];
        } else {
          currentWindow.push(events[i]);
        }
      }
      if (currentWindow.length > 0) windows.push(currentWindow);
    }
    
    console.log(\`Processing \${windows.length} windows...\`);
    
    const windowResults = [];
    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      const aggregated = await this.aggregateWindow(window);
      windowResults.push({
        windowIndex: i,
        size: window.length,
        aggregated,
      });
    }
    
    return windowResults;
  }

  async aggregateWindow(window) {
    const numericFields = {};
    const counts = {};
    
    for (const event of window) {
      for (const [key, value] of Object.entries(event)) {
        if (typeof value === "number") {
          if (!numericFields[key]) {
            numericFields[key] = { sum: 0, min: value, max: value, count: 0 };
          }
          numericFields[key].sum += value;
          numericFields[key].min = Math.min(numericFields[key].min, value);
          numericFields[key].max = Math.max(numericFields[key].max, value);
          numericFields[key].count++;
        } else {
          counts[key] = counts[key] || {};
          counts[key][value] = (counts[key][value] || 0) + 1;
        }
      }
    }
    
    // Calculate averages
    const stats = {};
    for (const [key, data] of Object.entries(numericFields)) {
      stats[key] = {
        avg: data.sum / data.count,
        min: data.min,
        max: data.max,
        sum: data.sum,
      };
    }
    
    return { stats, counts, eventCount: window.length };
  }

  getMetrics() {
    return {
      ...this.metrics,
      throughput: this.metrics.processed / (Date.now() / 1000),
      dropRate: this.metrics.received > 0 
        ? (this.metrics.dropped / this.metrics.received * 100).toFixed(2) + "%"
        : "0%",
    };
  }

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

// Demo: IoT Sensor Data Processing
async function runIoTDemo() {
  console.log("=== Streaming Pipeline: IoT Sensor Processing ===\\n");
  
  // Create pipeline
  const pipeline = new StreamingPipeline({ bufferSize: 50, windowSize: 10 });
  
  // Add processors
  pipeline
    .pipe(async (event) => {
      // Parse and validate
      if (!event.sensorId || !event.reading) return null;
      return { ...event, parsedAt: Date.now() };
    })
    .pipe(async (event) => {
      // Enrich with metadata
      const sensorTypes = { temp: "Temperature", humidity: "Humidity", pressure: "Pressure" };
      return {
        ...event,
        sensorType: sensorTypes[event.sensorType] || "Unknown",
        location: ["Building A", "Building B", "Building C"][event.sensorId % 3],
      };
    })
    .pipe(async (event) => {
      // Apply threshold filtering
      if (event.sensorType === "Temperature" && event.reading > 100) {
        event.alert = "HIGH_TEMPERATURE";
      }
      return event;
    })
    .pipe(async (event) => {
      // Transform units
      if (event.sensorType === "Temperature") {
        event.celsius = event.reading;
        event.fahrenheit = (event.reading * 9/5) + 32;
      }
      return event;
    })
    .to(async (event) => {
      // Sink: Log alerts
      if (event.alert) {
        console.log(\`🚨 ALERT: \${event.alert} - \${event.sensorId} @ \${event.location}: \${event.celsius}°C\`);
      }
    })
    .to(async (event) => {
      // Sink: Store metrics
      // In real app, this would write to database
    });
  
  // Generate sensor data
  const sensorData = Array.from({ length: 100 }, (_, i) => ({
    timestamp: Date.now() + i * 100,
    sensorId: (i % 5) + 1,
    sensorType: ["temp", "humidity", "pressure"][i % 3],
    reading: Math.random() * 150, // Some will trigger alerts
  }));
  
  console.log(\`Processing \${sensorData.length} sensor events...\\n\`);
  
  const startTime = Date.now();
  const results = await pipeline.processStream(sensorData, {
    onProgress: ({ processed, total }) => {
      if (processed % 25 === 0) {
        console.log(\`Progress: \${processed}/\${total} events\`);
      }
    },
  });
  
  const duration = Date.now() - startTime;
  
  console.log("\\n=== Results ===");
  console.log("Duration:", duration, "ms");
  console.log("Metrics:", pipeline.getMetrics());
  console.log("Processed events:", results.length);
  console.log("Alerts triggered:", results.filter(r => r.alert).length);
}

// Demo: Windowed Analytics
async function runWindowedAnalyticsDemo() {
  console.log("\\n\\n=== Windowed Stream Analytics ===\\n");
  
  const pipeline = new StreamingPipeline({ windowSize: 20, windowSlide: 10 });
  
  // Generate time-series data (e.g., website events)
  const events = Array.from({ length: 200 }, (_, i) => ({
    timestamp: Date.now() + (i * 50), // 50ms intervals
    userId: \`user_\${(i % 10) + 1}\`,
    page: ["/home", "/products", "/cart", "/checkout"][i % 4],
    duration: Math.floor(Math.random() * 300) + 10,
    bytesTransferred: Math.floor(Math.random() * 10000),
  }));
  
  console.log("Tumbling Windows:");
  const tumblingResults = await pipeline.processWindowed(events, "tumbling");
  console.log(\`  \${tumblingResults.length} windows created\`);
  console.log("  Sample window stats:", JSON.stringify(tumblingResults[0]?.aggregated?.stats, null, 2));
  
  console.log("\\nSliding Windows:");
  const slidingResults = await pipeline.processWindowed(events, "sliding");
  console.log(\`  \${slidingResults.length} windows created\`);
  
  // Analyze page popularity
  const pageViews = {};
  for (const event of events) {
    pageViews[event.page] = (pageViews[event.page] || 0) + 1;
  }
  
  console.log("\\nPage View Distribution:");
  for (const [page, count] of Object.entries(pageViews)) {
    const bar = "█".repeat(Math.floor(count / 5));
    console.log(\`  \${page.padEnd(12)} \${bar} \${count}\`);
  }
}

// Demo: Real-time Aggregation
async function runRealTimeAggregationDemo() {
  console.log("\\n\\n=== Real-time Aggregation ===\\n");
  
  const pipeline = new StreamingPipeline();
  
  // Simulated stock tick data
  const stocks = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"];
  const tickData = [];
  
  for (let i = 0; i < 500; i++) {
    tickData.push({
      timestamp: Date.now() + i * 10,
      symbol: stocks[i % stocks.length],
      price: 100 + Math.random() * 900,
      volume: Math.floor(Math.random() * 1000) + 1,
    });
  }
  
  // Processors for stock analysis
  const processed = [];
  pipeline
    .pipe(async (tick) => {
      // Calculate price change
      const prevPrice = tickData
        .slice(0, tickData.indexOf(tick))
        .reverse()
        .find(t => t.symbol === tick.symbol)?.price;
      
      return {
        ...tick,
        change: prevPrice ? tick.price - prevPrice : 0,
        changePercent: prevPrice ? ((tick.price - prevPrice) / prevPrice * 100).toFixed(2) : 0,
      };
    })
    .pipe(async (tick) => {
      // Flag significant moves
      if (Math.abs(tick.changePercent) > 2) {
        tick.significant = true;
        tick.direction = tick.change > 0 ? "📈" : "📉";
      }
      return tick;
    })
    .to(async (tick) => {
      processed.push(tick);
    });
  
  await pipeline.processStream(tickData);
  
  // Aggregate by symbol
  const bySymbol = {};
  for (const tick of processed) {
    if (!bySymbol[tick.symbol]) {
      bySymbol[tick.symbol] = { ticks: [], volume: 0, significantMoves: 0 };
    }
    bySymbol[tick.symbol].ticks.push(tick);
    bySymbol[tick.symbol].volume += tick.volume;
    if (tick.significant) bySymbol[tick.symbol].significantMoves++;
  }
  
  console.log("Stock Summary:");
  for (const [symbol, data] of Object.entries(bySymbol)) {
    const prices = data.ticks.map(t => t.price);
    const avgPrice = (prices.reduce((a,b) => a+b, 0) / prices.length).toFixed(2);
    const minPrice = Math.min(...prices).toFixed(2);
    const maxPrice = Math.max(...prices).toFixed(2);
    
    console.log(\`\\n  \${symbol}:\`);
    console.log(\`    Ticks: \${data.ticks.length}, Volume: \${data.volume}\`);
    console.log(\`    Avg: $\${avgPrice}, Range: $\${minPrice} - $\${maxPrice}\`);
    console.log(\`    Significant moves: \${data.significantMoves}\`);
  }
  
  // Show significant moves
  const significant = processed.filter(t => t.significant);
  console.log(\`\\nSignificant Price Movements (\${significant.length}):\`);
  significant.slice(0, 5).forEach(t => {
    console.log(\`  \${t.direction} \${t.symbol}: \${t.changePercent}% ($\${t.price.toFixed(2)})\`);
  });
}

// Run all demos
async function main() {
  await runIoTDemo();
  await runWindowedAnalyticsDemo();
  await runRealTimeAggregationDemo();
  console.log("\\n✅ Streaming pipeline demos complete!");
}

main().catch(console.error);
`;

async function runExample() {
  console.log("=== SandboxAI: Streaming Pipeline ===\\n");

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
      code: streamingCode,
      engine: "v8",
      policy: "agent",
      timeout: 60000,
      context: "Streaming pipeline with backpressure"
    }));

    req.end();
  });
}

http.get("http://localhost:3000/api/stats", () => {
  runExample().catch(console.error);
}).on("error", () => {
  console.error("❌ Server not running");
});
