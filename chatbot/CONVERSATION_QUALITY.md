# Conversation quality baseline

Updated: 2026-09-10

## Applied principles

| Principle | Product behavior | Regression coverage |
|---|---|---|
| Keep context across turns and visible results | Retain category, filters, selected cards, and visible card order. Understand “첫 번째로 상담할게요” against what is on screen. | category → recommendation → ordinal selection |
| Resolve short follow-up questions against the last product focus | “두 번째는 얼마예요?” establishes a product focus; “60개월이면요?” and “그건 방문관리 돼요?” reuse it. Ambiguous pronouns ask for a number instead of guessing. | ordinal price → term follow-up → pronoun care; ambiguous pronoun; benefit evidence |
| Compare visible products conversationally | “1번이랑 2번 비교해줘” opens those products side by side. “둘 중 싼 건?” and “관리 방식은 뭐가 달라?” reuse that pair; an ambiguous pair request asks for two numbers. | direct ordinal comparison → price follow-up → care follow-up; ambiguous pair |
| Turn a comparison into one clear consultation choice | In comparison view, “1번으로 상담할게요” keeps only that product. “싼 걸로” uses common-term fees. A management request uses registered care data and asks for a number when multiple products qualify; ambiguous “이걸로” also asks for a number. | explicit choice; price-based choice; care-based clarification; ambiguous and invalid choice |
| Treat correction as a normal dialogue act | “왜 자꾸 같은 걸 물어봐”, “아까 답했는데” trigger repair: acknowledge once, retain known conditions, skip the repeated optional question, and show useful results. | repeated-question repair |
| Do not repeat a failed prompt verbatim | First no-match rephrases the optional brand or term question and gives two natural exits. A second no-match skips the optional slot and advances. | first and second no-match |
| Support one-shot and step-by-step requests | Both “정수기” followed by “추천해주세요” and “정수기 추천해주세요” lead to the same three-brand result. | sequential and direct recommendation |
| Resolve customer brand names to catalog labels | Treat 쿠쿠/CKOO, 엘지/LG, and 삼성/삼성전자 as the same brands while showing customer-facing Korean labels in results. | Cuckoo water purifier and LG air purifier requests |
| Explain zero-result conflicts with a useful next action | Test one-constraint relaxations against the catalog and say which budget, term, brand, or care condition can be widened and how many products would become available. | impossible budget → budget removal → recovered results |
| Keep recommendations inside the requested product type | Within each brand, first retain products whose names fit the selected category, then rank registered benefit signals and monthly fee. This prevents adjacent items such as a 조리수기 from representing the 정수기 category. | water purifier, air purifier, and bidet three-brand recommendations |
| Make failures testable before release | High-risk happy paths and breakdown paths are deterministic regression scenarios. | `conversation-regression.mjs` |

## References

- Saleema Amershi et al., “Guidelines for Human-AI Interaction,” CHI 2019. In particular: make clear what the system can do, support efficient correction, remember recent interactions, and scope behavior when uncertain. https://doi.org/10.1145/3290605.3300233
- Matthew K. Hong et al., “Planning for Natural Language Failures with the AI Playbook,” CHI 2021. The test suite follows its recommendation to enumerate and test failure scenarios instead of validating only ideal flows. https://www.microsoft.com/en-us/research/publication/planning-for-natural-language-failures-with-the-ai-playbook/
- Google Conversation Design, “Errors.” No-match prompts should be context-specific, should not repeat the original prompt verbatim, should add support on the next attempt, and optional information may be skipped. https://developers.google.com/assistant/conversation-design/errors
- Google Conversation Design, “Learn about conversation.” Follow-up utterances and references to visible items require the previous turn and screen state. https://developers.google.com/assistant/conversation-design/learn-about-conversation
- Vevake Balaraman et al., “No, that’s not what I meant: Handling Third Position Repair in Conversational Question Answering,” SIGDIAL 2023. User corrections following an incorrect response are treated as a repair sequence, not a fresh unrelated query. https://aclanthology.org/2023.sigdial-1.52/
- Rasa, “Conversation Patterns.” Correction, clarification, interruption, and fallback are modeled as reusable repair patterns instead of isolated replies. https://rasa.com/docs/learn/concepts/conversation-patterns/

## Run the regression suite

```powershell
node --import ./chatbot/tests/register-loader.mjs ./chatbot/tests/conversation-regression.mjs
```

The suite uses public catalog fields only. It does not write customer messages, contact details, or catalog-derived rankings to external services.
