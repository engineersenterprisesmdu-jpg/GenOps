import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Resolve directories safely for both ES Modules (dev) and CommonJS (compiled production build)
  const currentDir = typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  if (process.env.NODE_ENV !== "production") {
    // Development mode: Integrate Vite developer middleware
    console.log("Starting server in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve compiled static files from dist/
    console.log("Starting server in production mode...");
    const distPath = path.resolve(currentDir, "dist");
    
    // Serve static files with caching
    app.use(express.static(distPath, {
      maxAge: "1d",
      redirect: false
    }));

    // Fallback UI routing to index.html (supports client-side multi-routing without 404)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}/`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server on boot:", err);
  process.exit(1);
});
