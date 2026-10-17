import { Router } from "express";

const router = Router();

// This checks that the HTTP process responds; it does not check database availability.
router.get("/", (request, response) => {
  response.json({ status: "ok" });
});

export default router;
