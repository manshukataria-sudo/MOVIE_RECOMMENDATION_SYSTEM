import { useState } from "react";
import ReactMarkdown from "react-markdown";

function getAnswerText(answer) {
  if (typeof answer === "string") {
    return answer;
  }

  if (Array.isArray(answer)) {
    return answer
      .map((part) => (typeof part === "string" ? part : part.text || ""))
      .join("");
  }

  return "";
}

export default function App() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitQuery(event) {
    event.preventDefault();

    const cleanedQuery = query.trim();
    if (!cleanedQuery || loading) {
      return;
    }

    setLoading(true);
    setQuery("");
    setAnswer("");
    setError("");

    try {
      const response = await fetch("/api/movie/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: cleanedQuery })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The request could not be completed.");
      }

      setAnswer(getAnswerText(result.answer));
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the movie service.");
    } finally {
      setLoading(false);
    }
  }

  function handleQueryKeyDown(event) {
    // Enter sends the query; Shift+Enter keeps a line break in the text box.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form.requestSubmit();
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Movie Recommender home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>Movie Recommender</span>
        </a>
        <span className="topbar-note">A little help picking tonight's movie</span>
      </header>

      <section className="content">
        <div className="hero">
          <p className="eyebrow">YOUR NEXT MOVIE NIGHT</p>
          <h1>Tell us what<br />you feel like watching.</h1>
          <p className="intro">
            Name a movie, an actor, or describe the kind of story you’re in the
            mood for. We’ll find something to watch.
          </p>
        </div>

        <form className="query-form" onSubmit={submitQuery}>
          <label htmlFor="movie-query">Your movie request</label>
          <textarea
            id="movie-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleQueryKeyDown}
            placeholder="For example: Find me a thoughtful sci-fi movie like Interstellar"
            rows={3}
            required
          />
          <div className="form-footer">
            <span className="keyboard-hint">Press Enter to search · Shift+Enter for a new line</span>
            <button type="submit" disabled={loading || !query.trim()}>
              {loading ? "Finding a movie..." : "Get recommendations"}
              {!loading && <span aria-hidden="true"> →</span>}
            </button>
          </div>
        </form>

        {loading && (
          <div className="status" role="status">
            <span className="loading-dot" aria-hidden="true" />
            <span>Looking through the movie collection…</span>
          </div>
        )}

        {error && (
          <section className="result error" role="alert">
            <p className="result-label">A SMALL SETBACK</p>
            <h2>We couldn’t get a recommendation.</h2>
            <p>{error}</p>
          </section>
        )}

        {answer && (
          <section className="result" aria-live="polite">
            <p className="result-label">PICKED FOR YOU</p>
            <div className="answer">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </section>
        )}
      </section>

      <footer className="page-footer">
        Good stories are better when shared.
      </footer>
    </main>
  );
}
