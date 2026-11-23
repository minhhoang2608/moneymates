---
name: writing-tickets
description: Ticket templates (BA feature ticket and Tech Lead sub-ticket), acceptance-criteria style, sizing rules, labels and dependency syntax for MoneyMates issues. Load when creating, rewriting, splitting or triaging tickets (BA, Tech Lead triage, Tester bugs).
---

# Writing tickets

Tickets come in two levels:

| Level          | Written by         | Content                                                                                       | Labels                                                          | Assigned?                                       |
| -------------- | ------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| **Feature**    | BA                 | What the user can do: user-facing, end-to-end acceptance criteria. No implementation details. | `type:feature`, `priority:*`, `status:triage` (**no `area:*`**) | No. Triage turns it into a parent (`type:epic`) |
| **Sub-ticket** | Tech Lead (triage) | One PR of technical work for one Dev area, with technical acceptance criteria                 | `type:feature` / `type:chore`, `priority:*`, `area:*`           | Yes, by area                                    |

Bugs filed by the Tester are single tickets. Triage adds `area:*` and marks them ready, or splits them when they span FE and BE.

## Feature ticket template (BA)

```markdown
## Goal

As a <user>, I can <do something> so that <value>.

## Scope

**In scope**

- ...
  **Out of scope**
- ...
  **Source:** docs/plan-chuc-nang-giao-dien.md § <section>

## Acceptance criteria

- [ ] AC1: Given <state>, when <user action>, then <what the user sees or what is saved>.
- [ ] AC2: ...

## Dependencies

Depends on #<n> <!-- feature-level only, e.g. settlement needs groups -->

## Notes

<Real-device checks (deeplink, camera, speech), golden cases needed, open questions.>
```

## Sub-ticket template (Tech Lead)

```markdown
Parent: #<feature>

## Goal

<The technical outcome of this PR in one or two sentences.>

## Scope

**In scope** (files/modules)

- ...
  **Out of scope**
- ...

## Acceptance criteria

- [ ] AC1: <technical, testable: function/endpoint/screen behaviour with concrete values> (covers feature AC2)
- [ ] AC2: ...

## Dependencies

Depends on #<n>

## Technical notes

<Tables/fields, endpoint + JSON request/response shapes, test data, E2E fixture needs, real-device checks.>
```

Title: imperative and specific, with no area prefix. For example: "Parse VietQR payload into bank, account, amount and message".

## Splitting a feature (Tech Lead)

- Split by Dev area: `area:mobile` (Dev FE), `area:api` (Dev BE), `area:infra` (foundation, tooling; Dev Fullstack). Use one sub-ticket with **both** areas (Dev Fullstack) only when the FE and BE parts are too small or too coupled to split.
- Within an area, split large work by layer: pure logic + tests → persistence → screen → wiring and Maestro flow.
- Map every feature acceptance criterion to at least one sub-ticket ("covers feature AC2"). Nothing may fall between the cracks.
- Order with `Depends on #N`: foundation → schema and contracts → API endpoint → FE wiring that calls it.
- The API contract (request/response JSON) is written in **both** the BE and the FE sub-ticket, so they can be built in parallel against a mock.

## Acceptance criteria rules

- Every criterion is **testable** and maps to at least one automated test (unit, API or Maestro), or is explicitly marked _(real device)_.
- Use concrete values. Write "Given amount 1.000.000đ split equally among 3 members, then shares are 333.334đ, 333.333đ, 333.333đ", not "splits correctly".
- Cover the error and empty paths named in the docs, for example: AI fails or quota runs out → form stays editable and category is "Khác".
- Quote Vietnamese UI strings exactly as in the docs.
- 3–7 criteria. More than that means the ticket is too big.

## Sizing (sub-tickets)

- One PR, about one day of agent work, **≤ ~400 changed lines** excluding generated and lock files.
- Foundation (app shells, CI commands, test runners) is `type:chore` + `area:infra`, done first.

## Labels

- Exactly one `type:*` and exactly one `priority:*`. p0 blocks everything; p1 is a core v1 flow; p2 normal; p3 nice to have. Sub-tickets inherit the parent's priority unless they block others (then raise it).
- `area:*` is set by the **Tech Lead**, never by BA.
- New tickets start at `status:triage` (BA). Sub-tickets are created without status, and the workflow sets `status:ready`. Agents never add `agent:*` or `needs-human`.

## Dependencies

One per line, exactly `Depends on #N`. Scripts parse this and only assign a ticket once every dependency is merged into `dev` (`status:testing`, `status:done` or closed).
