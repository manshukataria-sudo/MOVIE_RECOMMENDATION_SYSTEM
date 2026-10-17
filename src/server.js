import app from "./app.js";
import { env } from "./config/env.js";

// Start listening only from this entry point; importing the app stays side-effect free.
app.listen(env.port, () => {
  console.log(`API server listening on port ${env.port} (${env.nodeEnv}).`);
});
