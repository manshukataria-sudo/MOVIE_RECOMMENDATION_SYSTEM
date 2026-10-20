# Movie Recommender

A movie recommendation system built with **React, Node.js, Express, Neo4j, Pinecone, and Google Gemini**. It combines graph-based movie lookups with vector search to recommend movies based on titles, descriptions, actors, and directors.

## Features

- **Movie Recommendations:** Find similar movies using Pinecone vector search.
- **Graph-Based Search:** Discover movies by actor or director using Neo4j.
- **Hybrid Retrieval:** Combines graph queries and vector search.
- **LLM Integration:** Uses Google Gemini to understand queries and generate responses.
- **CSV Indexing:** Imports movie data into Neo4j and Pinecone.
- **React Frontend:** Simple interface for submitting queries and viewing recommendations.

## Tech Stack

- Frontend: React, Vite
- Backend: Node.js, Express
- Graph Database: Neo4j Aura
- Vector Database: Pinecone
- AI Models: Google Gemini and Google Generative AI Embeddings
- Language: JavaScript (ES Modules)

## Setup

**1. Install backend dependencies**

```bash
npm install
```

**2. Configure environment variables**

Create a `.env` file using `.env.example` and configure:

- `GOOGLE_API_KEY`
- `GOOGLE_CHAT_MODEL`
- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`

Create a Pinecone index with **768 dimensions**. Keep API keys private.

**3. Index movie data**

```bash
npm run index:neo4j
npm run index:pinecone
```

Both scripts use `src/data/movies.csv` by default.

**4. Start the backend**

```bash
npm start
```

For development:

```bash
npm run dev
```

**5. Start the frontend**

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL provided by Vite, usually `http://localhost:5173`.

## API Usage

Send a movie recommendation query:

```bash
curl -X POST http://localhost:3000/api/movie/recommend \
  -H "Content-Type: application/json" \
  -d '{"query":"Recommend movies similar to Interstellar"}'
```

## Future Improvements

- Persistent chat history
- Multi-page interface
- Additional recommendation methods
