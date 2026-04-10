# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-10

### Added
- Integrated zero-dependency \`acorn\` AST parser for deep structural analysis of untrusted executions.
- Expanded security posture to capture environmental accesses (e.g. \`require\`, \`process\`, \`eval\`).
- Included AST telemetry payload containing structural metrics inside of execution audits.
- Completely revamped README with execution examples and telemetry output reference.

## [Unreleased]

### Added
- Initial release of SandboxAI
- WASM sandboxing with Edge.js for secure code execution
- Multi-engine support (V8, JavaScriptCore, QuickJS, SpiderMonkey, Hermes)
- MCP-compatible AI agent interface
- Real-time dashboards with security monitoring
- Comprehensive security features:
  - API key authentication
  - Rate limiting with configurable windows
  - CORS policy configuration
  - Request body size limits
  - Dangerous code pattern detection (11 categories)
  - Audit logging with chain of custody
  - Structured JSON logging
- Result caching with SHA256-based keys
- Execution queue with priority-based concurrency
- Streaming output via Server-Sent Events
- Security hardening:
  - Template injection vulnerability fix
  - Secure temp file handling with mkdtemp
  - Async file operations
  - StreamManager memory leak fixes
  - Safe binary discovery
  - Graceful shutdown handling

### Security
- Implemented protection against command execution attacks
- Added detection for code injection patterns (eval, new Function)
- File system access controls
- Network request filtering
- Prototype pollution detection
- WebAssembly execution controls

## [1.0.0] - 2024-01-15

### Added
- Initial public release
- Core sandbox execution engine
- HTTP API server
- Web dashboard for monitoring
- Documentation and examples
