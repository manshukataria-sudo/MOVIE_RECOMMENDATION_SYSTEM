import express from "express"
import { getRecommendedMovies } from "../controller/movieController.js"
const router = express.Router()


// receiving the user's query, and getting the recommended movies from the model
router.post("/recommend", getRecommendedMovies)

export default router