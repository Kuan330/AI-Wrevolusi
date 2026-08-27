# Epics and Dependencies

## Epic list

1. E1 - Describe and Confirm My Work (non-AI)
2. E2 - Understand How AI May Change My Tasks (**AI/ML**: NLP task matching and task classification)
3. E3 - Recognise My Existing Capabilities (**AI/ML**: NLP capability recognition and text matching)
4. E4 - Review and Correct the Results (non-AI)
5. E5 - Explore Possible Career Directions (**AI/ML**: capability matching and pathway ranking)
6. E6 - Choose What to Prepare First (**AI/ML**: personalised priority ranking)
7. E7 - Take Practical Preparation Actions (non-AI)
8. E8 - Adjust My Plan to Fit My Time (non-AI)

Exactly four Epics use AI/ML: **E2, E3, E5, E6**.

## Required dependency flow

- E1 -> E2 -> E3
- E4 supports review and correction across all Epics
- E5 depends on E1, E2, E3 and E4
- E6 depends on E2, E3 and E4. E5 is optional
- E7 depends on E6 and E4
- E8 depends on E7 and E4
- E7 feedback may update E6 priorities

## Three implementation iterations

### Iteration 1 (this starter pull request)

- Repository setup and quality tooling
- Basic shell and placeholder pages
- Shared types, fixtures, and documentation

### Iteration 2

- Implement E1-E4 core user flow with review and correction loop
- Start structured data capture for tasks and capabilities

### Iteration 3

- Implement E5-E8 planning flow
- Add ranking outputs and practical preparation plan adjustments
