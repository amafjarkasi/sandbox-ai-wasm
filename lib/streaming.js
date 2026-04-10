/**
 * SandboxAI - Stream Manager
 * Handles Server-Sent Events for real-time execution output
 */

class StreamManager {
  constructor() {
    this.streams = new Map();
    this.clients = new Map();
    this.cleanupTimers = new Map(); // Track cleanup timers to prevent memory leaks
  }

  /**
   * Create a new stream
   */
  createStream(executionId) {
    const stream = {
      id: executionId,
      chunks: [],
      clients: new Set(),
      createdAt: Date.now(),
      closed: false,
    };
    this.streams.set(executionId, stream);
    return stream;
  }

  /**
   * Subscribe a client to a stream
   */
  subscribe(executionId, clientId, onData) {
    let stream = this.streams.get(executionId);
    if (!stream) {
      stream = this.createStream(executionId);
    }

    const client = { id: clientId, onData };
    stream.clients.add(client);
    this.clients.set(clientId, { streamId: executionId, client });

    // Send any buffered chunks
    for (const chunk of stream.chunks) {
      onData(chunk);
    }

    return () => this.unsubscribe(clientId);
  }

  /**
   * Unsubscribe a client
   */
  unsubscribe(clientId) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) return;

    const { streamId, client } = clientInfo;
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.clients.delete(client);
    }
    this.clients.delete(clientId);
  }

  /**
   * Write data to a stream
   */
  write(executionId, data) {
    const stream = this.streams.get(executionId);
    if (!stream || stream.closed) return;

    const chunk = {
      ...data,
      timestamp: Date.now(),
    };

    stream.chunks.push(chunk);

    for (const client of stream.clients) {
      try {
        client.onData(chunk);
      } catch (e) {
        // Client disconnected
        stream.clients.delete(client);
      }
    }
  }

  /**
   * Close a stream
   */
  close(executionId, finalData = null) {
    const stream = this.streams.get(executionId);
    if (!stream) return;

    // Prevent multiple close calls from creating multiple timers
    if (stream.closed) return;

    stream.closed = true;

    if (finalData) {
      this.write(executionId, { type: "complete", ...finalData });
    }

    // Clear any existing cleanup timer for this stream
    const existingTimer = this.cleanupTimers.get(executionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule cleanup after a delay
    const cleanupTimer = setTimeout(() => {
      for (const client of stream.clients) {
        this.clients.delete(client.id);
      }
      this.streams.delete(executionId);
      this.cleanupTimers.delete(executionId);
    }, 60000);

    this.cleanupTimers.set(executionId, cleanupTimer);
  }

  /**
   * Force immediate cleanup of a stream
   */
  cleanup(executionId) {
    const stream = this.streams.get(executionId);
    if (!stream) return;

    // Clear any pending cleanup timer
    const existingTimer = this.cleanupTimers.get(executionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.cleanupTimers.delete(executionId);
    }

    // Remove all clients
    for (const client of stream.clients) {
      this.clients.delete(client.id);
    }

    // Remove the stream
    this.streams.delete(executionId);
  }

  /**
   * Clean up all resources (for graceful shutdown)
   */
  destroy() {
    // Clear all pending timers
    for (const [executionId, timer] of this.cleanupTimers) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    // Clear all client references
    this.clients.clear();

    // Clear all streams
    this.streams.clear();
  }

  /**
   * Get stream statistics
   */
  getStats() {
    return {
      activeStreams: this.streams.size,
      activeClients: this.clients.size,
      streams: Array.from(this.streams.entries()).map(([id, stream]) => ({
        id,
        clients: stream.clients.size,
        chunks: stream.chunks.length,
        createdAt: stream.createdAt,
        closed: stream.closed,
      })),
    };
  }
}

module.exports = { StreamManager };
