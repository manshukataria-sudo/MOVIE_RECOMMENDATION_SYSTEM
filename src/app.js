import express from "express";
import healthRouter from "./routes/health.js";

const app = express();

app.use(express.json());

// Keep route setup separate from server startup so the app can be imported in tests.
app.use("/health", healthRouter);

export default app;
