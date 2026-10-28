import assert from "node:assert/strict";
import test from "node:test";
import { sequenceExample } from "../lib/examples.ts";
import {
  extractSections,
  linkSections,
  normalizeLabel,
} from "../lib/navigation.ts";

test("bundled example exposes seven stages, with source labels to anchor each stage", () => {
  const sections = extractSections(sequenceExample);
  assert.equal(sections.length, 7);
  assert.equal(sections[0].title, "0. 상품·제휴처 조회 (공개 API)");
  assert.equal(sections[6].title, "6. 고객 취소 (선택)");
  assert.equal(sections[3].labels[0], "서명 1: RedeemQuote EIP-712 서명 요청");
  assert.ok(sections.every((section) => section.labels.length > 0));
});

test("ordinary comments and directives do not become sections", () => {
  const sections = extractSections(
    `sequenceDiagram\n%% implementation note\n%%{init: {}}%%\n%% # 첫 단계\nA->>B: Hello<br/>world\n%% explanatory comment\nNote over A,B: More info\n%% 2) 두 번째 단계\nB-->>A: Done`,
  );
  assert.equal(sections.length, 2);
  assert.equal(sections[0].line, 4);
  assert.deepEqual(sections[0].labels, ["Hello<br/>world", "More info"]);
});

test("repeated labels resolve after every message in the preceding section", () => {
  const sections = extractSections(
    `%% 1. First\nA->>B: Retry\nB->>A: Retry\n%% 2. Second\nA->>B: Retry\n%% 3. Empty`,
  );
  const entries = [10, 20, 30].map((y) => ({ normalized: "retry", y }));
  const linked = linkSections(sections, entries);
  assert.equal(linked[0].target.y, 10);
  assert.equal(linked[1].target.y, 30);
  assert.equal(linked[2].target, undefined);
});

test("an unresolvable section does not prevent a later section from linking", () => {
  const linked = linkSections(
    [
      { title: "missing", line: 1, labels: ["Unknown"] },
      { title: "found", line: 3, labels: ["Hello<br/>World"] },
    ],
    [{ normalized: "hello world", y: 100 }],
  );
  assert.equal(linked[0].target, undefined);
  assert.equal(linked[1].target.y, 100);
  assert.equal(normalizeLabel("  ＡＰＩ <br />  Request  "), "api request");
});

test("a multiline message anchors to its first rendered line", () => {
  const sections = extractSections(
    "%% 1. Submit\nA->>B: POST /api/quote<br/>{payload}\nB-->>A: Accepted",
  );
  const linked = linkSections(sections, [
    { normalized: "post /api/quote", y: 10 },
    { normalized: "{payload}", y: 30 },
    { normalized: "accepted", y: 60 },
  ]);
  assert.equal(linked[0].target.y, 10);
});
