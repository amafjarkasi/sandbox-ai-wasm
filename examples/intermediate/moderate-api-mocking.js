/**
 * SandboxAI Example: Moderate - API Mocking & Testing
 * Simulates API responses for testing without external dependencies
 */

const http = require("node:http");

const apiMockingCode = `
// Mock API Server Simulation
class MockAPI {
  constructor() {
    this.users = [
      { id: 1, name: "Alice", role: "admin", active: true },
      { id: 2, name: "Bob", role: "user", active: true },
      { id: 3, name: "Carol", role: "user", active: false },
      { id: 4, name: "David", role: "moderator", active: true },
      { id: 5, name: "Eve", role: "user", active: true },
    ];
    this.posts = [
      { id: 1, userId: 1, title: "Hello World", likes: 42 },
      { id: 2, userId: 2, title: "My Post", likes: 12 },
      { id: 3, userId: 1, title: "Update", likes: 89 },
      { id: 4, userId: 3, title: "Draft", likes: 0 },
      { id: 5, userId: 4, title: "Rules", likes: 156 },
    ];
    this.requestLog = [];
  }

  // Simulate API delay
  async delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // GET /users
  async getUsers(filters = {}) {
    await this.delay(10);
    this.requestLog.push({ method: 'GET', path: '/users', filters });
    
    let result = [...this.users];
    if (filters.role) result = result.filter(u => u.role === filters.role);
    if (filters.active !== undefined) result = result.filter(u => u.active === filters.active);
    
    return { data: result, total: result.length };
  }

  // GET /users/:id
  async getUser(id) {
    await this.delay(5);
    this.requestLog.push({ method: 'GET', path: \`/users/\${id}\` });
    
    const user = this.users.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    return { data: user };
  }

  // GET /posts
  async getPosts(userId) {
    await this.delay(15);
    this.requestLog.push({ method: 'GET', path: '/posts', userId });
    
    const posts = userId 
      ? this.posts.filter(p => p.userId === userId)
      : this.posts;
    return { data: posts, total: posts.length };
  }

  // POST /posts
  async createPost(userId, title) {
    await this.delay(20);
    this.requestLog.push({ method: 'POST', path: '/posts', userId, title });
    
    const newPost = {
      id: this.posts.length + 1,
      userId,
      title,
      likes: 0,
      createdAt: new Date().toISOString()
    };
    this.posts.push(newPost);
    return { data: newPost };
  }

  // Analytics
  async getAnalytics() {
    await this.delay(30);
    
    const userActivity = this.users.map(u => ({
      ...u,
      postCount: this.posts.filter(p => p.userId === u.id).length,
      totalLikes: this.posts
        .filter(p => p.userId === u.id)
        .reduce((s, p) => s + p.likes, 0)
    }));

    const popularPosts = [...this.posts]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 3);

    return {
      totalUsers: this.users.length,
      activeUsers: this.users.filter(u => u.active).length,
      totalPosts: this.posts.length,
      totalLikes: this.posts.reduce((s, p) => s + p.likes, 0),
      avgLikesPerPost: (this.posts.reduce((s, p) => s + p.likes, 0) / this.posts.length).toFixed(2),
      userActivity,
      popularPosts
    };
  }
}

// Test Suite
async function runTests() {
  const api = new MockAPI();
  const results = [];

  // Test 1: Get all users
  try {
    const users = await api.getUsers();
    console.log("✓ Test 1: Get all users -", users.total, "users");
    results.push({ test: "getUsers", status: "pass", count: users.total });
  } catch (e) {
    results.push({ test: "getUsers", status: "fail", error: e.message });
  }

  // Test 2: Filter users by role
  try {
    const admins = await api.getUsers({ role: "admin" });
    console.log("✓ Test 2: Filter admins -", admins.total, "found");
    results.push({ test: "filterByRole", status: "pass", count: admins.total });
  } catch (e) {
    results.push({ test: "filterByRole", status: "fail", error: e.message });
  }

  // Test 3: Get user by ID
  try {
    const user = await api.getUser(1);
    console.log("✓ Test 3: Get user by ID -", user.data.name);
    results.push({ test: "getUser", status: "pass", name: user.data.name });
  } catch (e) {
    results.push({ test: "getUser", status: "fail", error: e.message });
  }

  // Test 4: Get posts for user
  try {
    const posts = await api.getPosts(1);
    console.log("✓ Test 4: Get user posts -", posts.total, "posts");
    results.push({ test: "getPosts", status: "pass", count: posts.total });
  } catch (e) {
    results.push({ test: "getPosts", status: "fail", error: e.message });
  }

  // Test 5: Create post
  try {
    const newPost = await api.createPost(2, "Test Post");
    console.log("✓ Test 5: Create post - ID:", newPost.data.id);
    results.push({ test: "createPost", status: "pass", id: newPost.data.id });
  } catch (e) {
    results.push({ test: "createPost", status: "fail", error: e.message });
  }

  // Test 6: Get analytics
  try {
    const analytics = await api.getAnalytics();
    console.log("✓ Test 6: Analytics -", analytics.totalPosts, "posts," , analytics.totalLikes, "likes");
    results.push({ test: "analytics", status: "pass", posts: analytics.totalPosts });
  } catch (e) {
    results.push({ test: "analytics", status: "fail", error: e.message });
  }

  // Summary
  console.log("\\n=== Test Summary ===");
  console.log("Total:", results.length);
  console.log("Passed:", results.filter(r => r.status === "pass").length);
  console.log("Failed:", results.filter(r => r.status === "fail").length);
  
  console.log("\\n=== API Request Log ===");
  console.log(api.requestLog.map(r => \`\${r.method} \${r.path}\`).join("\\n"));

  return results;
}

runTests().then(results => {
  console.log("\\n=== Final Results ===");
  console.log(JSON.stringify(results, null, 2));
});
`;

async function runExample() {
  console.log("=== SandboxAI: API Mocking & Testing ===\\n");

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
      code: apiMockingCode,
      engine: "v8",
      policy: "standard",
      timeout: 15000,
      context: "API mocking example"
    }));

    req.end();
  });
}

http.get("http://localhost:3000/api/stats", () => {
  runExample().catch(console.error);
}).on("error", () => {
  console.error("❌ Server not running");
});
