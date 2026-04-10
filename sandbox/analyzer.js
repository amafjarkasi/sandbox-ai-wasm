const acorn = require('acorn');
const walk = require('acorn-walk');

class AstAnalyzer {
  constructor() {
    // List of identifiers that are typically built-in and safe
    this.commonBuiltins = new Set([
      'console', 'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 
      'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Promise', 'Error'
    ]);
  }

  /**
   * Analyzes the given JavaScript code and extracts structural metrics
   * and potential environmental accesses.
   * @param {string} code - The JavaScript source code
   * @returns {Object} Extracted AST metrics
   */
  analyze(code) {
    const summary = {
      isValid: true,
      parseError: null,
      accessedIdentifiers: [],
      metrics: {
        loopCount: 0,
        functionCount: 0,
        astNodeCount: 0
      },
      flags: {
        hasEval: false,
        hasRequire: false,
        hasProcess: false
      }
    };

    let ast;
    try {
      // Parse expecting standard script execution (how Edge.js executes by default)
      ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch (err) {
      summary.isValid = false;
      summary.parseError = err.message;
      return summary;
    }

    const identifiersFound = new Set();

    walk.simple(ast, {
      Identifier(node) {
        summary.metrics.astNodeCount++;
        identifiersFound.add(node.name);

        if (node.name === 'eval') summary.flags.hasEval = true;
        if (node.name === 'require') summary.flags.hasRequire = true;
        if (node.name === 'process') summary.flags.hasProcess = true;
      },
      MemberExpression() { summary.metrics.astNodeCount++; },
      CallExpression() { summary.metrics.astNodeCount++; },
      
      // Control flow & Loops
      ForStatement() { summary.metrics.loopCount++; summary.metrics.astNodeCount++; },
      WhileStatement() { summary.metrics.loopCount++; summary.metrics.astNodeCount++; },
      DoWhileStatement() { summary.metrics.loopCount++; summary.metrics.astNodeCount++; },
      ForInStatement() { summary.metrics.loopCount++; summary.metrics.astNodeCount++; },
      ForOfStatement() { summary.metrics.loopCount++; summary.metrics.astNodeCount++; },
      
      // Functions
      FunctionDeclaration() { summary.metrics.functionCount++; summary.metrics.astNodeCount++; },
      ArrowFunctionExpression() { summary.metrics.functionCount++; summary.metrics.astNodeCount++; },
      FunctionExpression() { summary.metrics.functionCount++; summary.metrics.astNodeCount++; }
    });

    // Filter down to interesting identifiers (strip basic builtins to reduce noise)
    summary.accessedIdentifiers = Array.from(identifiersFound).filter(
      id => !this.commonBuiltins.has(id) && id.length > 1
    );

    return summary;
  }
}

module.exports = { AstAnalyzer };
