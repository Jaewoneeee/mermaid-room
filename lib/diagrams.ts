export function extractDiagrams(text: string) {
  const matches = [...text.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/gi)];
  return matches.length
    ? matches.map((match) => match[1].trim())
    : [text.trim()];
}
export const flowExample = `flowchart TD
    A[아이디어 발견] --> B[팀과 함께 검토]
    B --> C{개발을 시작할까요?}
    C -->|Yes| D[프로토타입 만들기]
    C -->|조금 더 고민| B
    D --> E[피드백 수집]
    E --> F[더 나은 제품 출시]`;
