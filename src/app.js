import express from "express";
import healthRouter from "./routes/health.js";
import movieRouter from "./routes/movieRoute.js";

const app = express();

app.use(express.json());

// Keep route setup separate from server startup so the app can be imported in tests.
app.use("/api/health", healthRouter);
app.use("/api/movie", movieRouter);

export default app;
