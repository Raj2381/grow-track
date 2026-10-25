import { evaluateAnswer, QUESTION_BANK, pickInterview } from "../evaluation";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failed++;
};
const ev = (q: string, a: string) => evaluateAnswer(q, a, { useLlm: false });
const Q = "tech-array-linkedlist"; // "Difference between array and linked list"

async function main() {
  let r = await ev(Q, "My name is Raj");
  check("name only on a technical question -> 0", r.score === 0 && !r.relevant, r.reason);
  r = await ev(Q, "");
  check("empty -> 0", r.score === 0);
  r = await ev(Q, "   \n ");
  check("whitespace -> 0", r.score === 0);
  r = await ev(Q, "asdfgh qwerty");
  check("gibberish -> 0", r.score === 0 && r.status === "gibberish");
  r = await ev(Q, "I don't know");
  check("I don't know -> 0", r.score === 0 && r.status === "filler");
  r = await ev(Q, "Difference between array and linked list?");
  check("copying the question -> 0", r.score === 0 && r.status === "copied");
  r = await ev(Q, "array linked list memory pointer O(1) O(n)");
  check("keyword stuffing -> low", r.score > 0 && r.score <= 3 && r.flags.includes("keyword-stuffing"), `score ${r.score}`);
  r = await ev(Q, "An array stores elements in contiguous memory, so you can reach any element by index in O(1). A linked list stores nodes connected by pointers, so insertion and deletion are cheap but access needs O(n) traversal. Use an array for fast lookups and a linked list for frequent insertions.");
  check("full correct answer -> 8-10", r.score >= 8 && r.score <= 10, `score ${r.score}`);
  check("pointers matches pointer (stemming)", r.matchedKeywords.includes("pointer"));
  r = await ev(Q, "An array stores elements in contiguous memory and allows index access.");
  check("partial short answer -> 3-6", r.score >= 3 && r.score <= 6, `score ${r.score}`);
  r = await ev(Q, "Linked lists have O(1) random access");
  check("contradiction -> deducted and flagged", r.score <= 1 && r.incorrectClaims.length === 1, `score ${r.score}`);
  const ok = await ev(Q, "Arrays have O(1) access by index whereas linked lists need O(n) traversal because nodes are connected by pointers in memory.");
  check("correct complexity claim is not flagged", ok.incorrectClaims.length === 0, `score ${ok.score}`);
  r = await ev(Q, "Object oriented programming uses classes and objects with inheritance, polymorphism and encapsulation to organise code into reusable units.");
  check("off-topic OOP answer -> 0", r.score === 0 && r.status === "irrelevant", `relevance ${r.relevanceScore}`);
  r = await ev("intro-1", "My name is Raj");
  check("intro: bare name -> low but non-zero", r.score > 0 && r.score <= 2, `score ${r.score}`);
  r = await ev("intro-1", "I am a final year B.Tech computer science student at XYZ college. I know Python and SQL, built a library management project during my internship, and I am looking for a software developer role.");
  check("intro: complete introduction -> high", r.score >= 8, `score ${r.score}`);
  r = await ev("beh-1", "My name is Raj and I am from Pune");
  check("self-introduction on a behavioral question -> 0", r.score === 0 && r.status === "self-intro");

  const cats = new Map<string, number>();
  QUESTION_BANK.forEach((q) => cats.set(q.category, (cats.get(q.category) ?? 0) + 1));
  check("bank has >=5 questions per category", [...cats.values()].every((n) => n >= 5) && cats.size === 5);
  check("bank ids are unique", new Set(QUESTION_BANK.map((q) => q.id)).size === QUESTION_BANK.length);
  // every sample ideal answer must score well against its own rubric
  for (const q of QUESTION_BANK) {
    const s = await ev(q.id, q.sampleIdealAnswer);
    check(`ideal answer scores >= 8: ${q.id}`, s.score >= 8, `score ${s.score}`);
  }
  check("pickInterview returns 5 public questions", pickInterview("QA Engineer").length === 5 && !("sampleIdealAnswer" in pickInterview()[0]));

  if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
  console.log("\nAll evaluation checks passed");
}
main();
