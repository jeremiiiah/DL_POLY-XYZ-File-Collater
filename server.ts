import express from "express";
import { createServer as createViteServer } from "vite";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const runEngine = (args: string[], input?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const python = spawn("python3", ["engine.py", ...args]);
      let output = "";
      let error = "";

      if (input) {
        python.stdin.write(input);
        python.stdin.end();
      }

      python.stdout.on("data", (data) => {
        output += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(error || `Process exited with code ${code}`));
        } else {
          resolve(output);
        }
      });
    });
  };

  // API Routes
  app.get("/api/data", async (req, res) => {
    try {
      const result = await runEngine(["get_data"]);
      res.json(JSON.parse(result));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/upload", async (req, res) => {
    const { filename, content } = req.body;
    try {
      const result = await runEngine(["upload", filename], content);
      res.json(JSON.parse(result));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/shift", async (req, res) => {
    const { filename, dx, dy, dz } = req.body;
    try {
      const result = await runEngine(["shift", filename, dx.toString(), dy.toString(), dz.toString()]);
      res.json(JSON.parse(result));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/order", async (req, res) => {
    const { filename, order } = req.body;
    try {
      const result = await runEngine(["order", filename, order.toString()]);
      res.json(JSON.parse(result));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/box", async (req, res) => {
    const { x, y, z } = req.body;
    try {
      const result = await runEngine(["box", x.toString(), y.toString(), z.toString()]);
      res.json(JSON.parse(result));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/reset", async (req, res) => {
    try {
      const result = await runEngine(["reset"]);
      res.json(JSON.parse(result));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/delete", async (req, res) => {
    const { filename } = req.body;
    console.log(`API: Deleting file ${filename}`);
    try {
      const result = await runEngine(["delete", filename]);
      console.log(`Engine result for delete: ${result}`);
      res.json(JSON.parse(result));
    } catch (err) {
      console.error(`API Error deleting file: ${(err as Error).message}`);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/config", async (req, res) => {
    const title = (req.query.title as string) || "Generated CONFIG";
    try {
      const result = await runEngine(["config", title]);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename=CONFIG');
      res.send(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
