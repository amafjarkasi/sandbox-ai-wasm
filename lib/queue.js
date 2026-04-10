/**
 * SandboxAI - Execution Queue
 * Manages concurrent execution with priority and timeout handling
 */

class ExecutionQueue {
  constructor({ maxConcurrency = 10, defaultTimeout = 30000 }) {
    this.maxConcurrency = maxConcurrency;
    this.defaultTimeout = defaultTimeout;
    this.queue = [];
    this.running = new Map();
    this.stats = {
      totalQueued: 0,
      totalExecuted: 0,
      totalRejected: 0,
      currentRunning: 0,
    };
  }

  /**
   * Run a task in the queue
   */
  async run(taskFn, options = {}) {
    const priority = options.priority || 0;
    const timeout = options.timeout || this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const task = {
        id: this._generateId(),
        fn: taskFn,
        priority,
        timeout,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      this.stats.totalQueued++;
      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority);

      this._processQueue();
    });
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queued: this.queue.length,
      running: this.running.size,
      maxConcurrency: this.maxConcurrency,
      stats: { ...this.stats },
    };
  }

  /**
   * Process the next tasks in queue
   */
  async _processQueue() {
    while (this.queue.length > 0 && this.running.size < this.maxConcurrency) {
      const task = this.queue.shift();
      this._executeTask(task);
    }
  }

  /**
   * Execute a single task with timeout
   */
  async _executeTask(task) {
    const startTime = Date.now();
    let settled = false;
    this.running.set(task.id, task);
    this.stats.currentRunning = this.running.size;

    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      task.reject(new Error(`Execution timeout after ${task.timeout}ms`));
      this.running.delete(task.id);
      this.stats.currentRunning = this.running.size;
      this.stats.totalRejected++;
      this._processQueue();
    }, task.timeout);

    try {
      const result = await task.fn();
      clearTimeout(timeoutHandle);
      if (settled) return;
      settled = true;
      task.resolve(result);
      this.stats.totalExecuted++;
    } catch (err) {
      clearTimeout(timeoutHandle);
      if (settled) return;
      settled = true;
      task.reject(err);
      this.stats.totalRejected++;
    } finally {
      this.running.delete(task.id);
      this.stats.currentRunning = this.running.size;
      if (settled) this._processQueue();
    }
  }

  _generateId() {
    return "queue_" + Math.random().toString(36).substring(2, 10);
  }
}

module.exports = { ExecutionQueue };
