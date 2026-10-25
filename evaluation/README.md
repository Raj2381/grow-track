# Mock-interview answer evaluation

Strict, explainable scoring for the student portal's Mock Interview. It runs **on the server**
(`app/api/mock-interview/evaluate`); the browser never sees rubrics or ideal answers before answering.

```
answer ─▶ A pre-checks ─▶ B relevance gate ─▶ C rubric scoring ─▶ D optional LLM ─▶ score (0.5 steps)
            └ any failed gate stops here with 0 marks and a reason
```

| Stage | File | What it does |
|---|---|---|
| A | `preChecks.ts` | empty · fewer than 3 meaningful words · gibberish (real-word ratio < 50 %, keyboard runs, repetition) · copies the question · filler ("I don't know", "ok", "hello") · self-introduction when the question isn't an intro question |
| B | `relevance.ts` | similarity of answer vs question and vs the ideal answer; below `RELEVANCE_THRESHOLD` (0.35) → 0 |
| C | `rubricScorer.ts` | must-have keywords 40 % · good-to-have 15 % (capped) · concept coverage 30 % · clarity/structure 15 % |
| D | `llmEvaluator.ts` | strict LLM grader, temperature 0, zod-validated JSON, one retry, 5 s timeout. Final = `min(rule, LLM)`. Any failure falls back to A–C |

Anti-gaming in stage C: keyword stuffing (many terms, almost no connecting words, under 2 sentences) multiplies the keyword
marks by 0.3; answers shorter than `minWords` are capped at 40 % of the marks; a claim that contradicts a key concept
(e.g. "linked lists have O(1) random access") is listed under *incorrect claims* and costs 3 marks.
Matching is case-insensitive with stemming (`pointers` ≈ `pointer`) and `a|b|c` synonyms.
On an intro question a bare name earns 1 mark instead of 0.

## Configuration

Every threshold and weight is in `config.ts`. Environment variables: `EVAL_RELEVANCE_THRESHOLD`, `EVAL_CONCEPT_THRESHOLD`,
`OPENAI_API_KEY` (enables stage D; leave unset for rules only) and `OPENAI_MODEL`.

## Adding a question

Append an object to `questionBank.json`:

```json
{
  "id": "tech-my-question", "category": "Technical Knowledge", "maxMarks": 10, "minWords": 25,
  "roles": ["Software Developer"],
  "question": "…?",
  "mustHaveKeywords": ["pointer|reference|address", "linked list"],
  "goodToHaveKeywords": ["bigo1|constant time"],
  "keyConcepts": ["linked lists connect nodes using pointers|references"],
  "contradictions": [{ "pattern": "regex on normalised text (O(1) is bigo1)", "note": "Why the claim is wrong." }],
  "sampleIdealAnswer": "A model answer."
}
```

Categories: Introduction, Technical Knowledge, Problem Solving, Communication, Behavioral (set `"intro": true` for
self-introduction questions). Write concepts as keyword groups, not prose: every non-stop word must appear (or have an
`a|b` alternative) in one sentence. `npm run test:evaluation` also checks that each sample answer scores ≥ 8/10, so a badly
written rubric fails the test.

## Embeddings

Stage B ships with a local lexical-semantic similarity so it needs no model download or key. To use sentence embeddings
(e.g. all-MiniLM-L6-v2 via `@xenova/transformers`), call `setSimilarity(fn)` once at server start with a cosine-of-embeddings function.

## Tests

`npm run test:evaluation` (also part of `npm test`).
