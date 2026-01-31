# PRD: Runtime Prompts and Matching Flow

## Overview

Enable the MCP server to use runtime prompts (instead of tool-based workaround) and implement a complete matching flow with seeded test data.

## Goals

1. **Runtime Prompts**: Add MCP prompts capability so the interview methodology is available as a proper runtime prompt
2. **Seed Data**: Populate database with 20 diverse personas for testing matching functionality
3. **Matching Flow**: Enable "I want to match [name]" → intake interview → match suggestions
4. **Testing**: Add tests/evals to verify the chat-based matching functionality

---

## Step 1: Add MCP Prompts Capability ✅ COMPLETE

### Tasks
- [x] Import `ListPromptsRequestSchema` and `GetPromptRequestSchema` from MCP SDK
- [x] Add `prompts: {}` to server capabilities
- [x] Register handler for `prompts/list` that returns the matchmaker interview prompt
- [x] Register handler for `prompts/get` that returns the full prompt content
- [x] Remove `start_intake_interview` tool (replaced by prompt)
- [x] Update tool descriptions to reference the prompt instead

### Acceptance Criteria
- MCP clients can list available prompts ✅
- MCP clients can retrieve the full interview methodology prompt ✅
- The prompt includes dynamic argument support (e.g., single_name, matchmaker_name) ✅

---

## Step 2: Create Seed Data Script ✅ COMPLETE

### Tasks
- [x] Create `src/seed-data.ts` with 20 diverse personas
- [x] Include 10 male and 10 female profiles
- [x] Vary completeness: some fully filled, some partial
- [x] Include realistic diversity:
  - Age range: 27-50
  - Locations: Houston, Dallas, Austin, San Antonio (Texas focus)
  - Ethnicities: Nigerian (Igbo, Yoruba), African American
  - Relationship histories: never married, divorced, widowed
  - Children: none, some with kids
  - Body types: slim, athletic, average, plus-size
  - Careers: various professions and income levels
  - Faith levels: varying degrees of religious involvement
- [x] Include realistic "red flags" and expectation mismatches for testing
- [x] Add CLI command to run seeding (`bun run seed`)

### Acceptance Criteria
- Running seed script populates database with 20 people ✅
- Personas are diverse and realistic ✅
- Some profiles have expectation mismatches for testing market reality discussions ✅
  - Jasmine (45, plus-size, wants athletic never-married man)
  - Ngozi (very high standards, 6'2"+ height requirement)
  - Tochukwu (36, never had LTR, extremely rigid requirements)
  - Andre (50, plus-size, wants slim woman 20 years younger)

---

## Step 3: Implement find_matches Tool ✅ COMPLETE

### Tasks
- [x] Re-add `find_matches` tool to the MCP server
- [x] Add tool to index.ts, handlers.ts, and tools.ts
- [x] Connect to existing API endpoint for matching
- [x] Return ranked list of potential matches with compatibility notes
- [x] Include match reasoning in response

### Acceptance Criteria
- Given a person ID, returns compatible matches from database ✅
- Tool properly validates person_id argument ✅
- Results include explanation of why each person is a good match ✅

---

## Step 4: Update Interview Flow for Matching ✅ COMPLETE

### Tasks
- [x] Modify prompt to include post-interview matching instructions
- [x] Add "Recognizing When to Start" section with trigger phrases
- [x] Add Scenario A (new person) and Scenario B (existing person) flows
- [x] Add "Presenting Matches to the Matchmaker" section with example format
- [x] Add "Creating Introductions" section for when matches are approved

### Acceptance Criteria
- Complete flow from "I want to match Johnny" → interview → profile saved → matches shown ✅
- Works for both new people and existing people in database ✅
- Prompt includes trigger phrase recognition ✅
- Prompt includes match presentation guidelines ✅

---

## Step 5: Add Integration Tests ✅ COMPLETE

### Tasks
- [x] Create `tests/matching-flow.test.ts`
- [x] Test prompt listing and retrieval (all 14 phases, trigger recognition)
- [x] Test seed data structure validation
- [x] Test find_matches tool (API calls, empty results, ranked matches)
- [x] Create eval scenarios:
  - New person intake → matching ✅
  - Existing person matching ✅
  - Edge cases (no matches found, deal breaker filtering) ✅

### Acceptance Criteria
- All new tests pass (15/15) ✅
- Coverage for core matching flow ✅
- Eval scenarios documented ✅

---

## Personas Overview (Step 2 Detail)

### Female Profiles (10)

1. **Adaeze Okonkwo** - 32, Nigerian, Houston, nurse, athletic, looking for Igbo man
2. **Michelle Thompson** - 28, African American, Dallas, marketing manager, slim, open to all
3. **Chidinma Eze** - 38, Nigerian, Austin, lawyer, average, divorced with 1 child
4. **Jasmine Williams** - 45, African American, Houston, teacher, plus-size, never married
5. **Ngozi Adeleke** - 29, Nigerian, Dallas, software engineer, slim, very selective on height
6. **Brittany Jackson** - 35, African American, San Antonio, nurse, athletic, wants highly fit partner
7. **Amara Nwosu** - 42, Nigerian, Houston, business owner, average, widowed
8. **Tiffany Brown** - 31, African American, Austin, accountant, slim, no kids preference
9. **Chiamaka Obi** - 27, Nigerian, Dallas, medical student, athletic, focused on career until recently
10. **Lauren Davis** - 40, African American, Houston, real estate agent, average, high income expectations

### Male Profiles (10)

1. **Chukwuemeka Adeyemi** - 34, Nigerian, Houston, petroleum engineer, athletic, looking for Yoruba woman
2. **Marcus Johnson** - 30, African American, Dallas, IT consultant, average, open to all
3. **Obiora Nnamdi** - 41, Nigerian, Austin, doctor, slim, divorced no kids
4. **DeShawn Williams** - 29, African American, Houston, personal trainer, very athletic, wants fit partner
5. **Tochukwu Ibe** - 36, Nigerian, Dallas, accountant, average, never had LTR (red flag)
6. **Kevin Mitchell** - 44, African American, San Antonio, pastor, average, widowed with 2 kids
7. **Emeka Okoro** - 33, Nigerian, Houston, banker, athletic, height 5'8" (shorter)
8. **Jamal Thompson** - 38, African American, Austin, lawyer, slim, high standards
9. **Ikenna Uche** - 28, Nigerian, Dallas, medical resident, slim, wants older woman
10. **Andre Cooper** - 50, African American, Houston, business owner, plus-size, wants much younger

---

## Success Metrics

1. Runtime prompt is accessible via MCP prompts/list and prompts/get
2. Seed script successfully creates 20 diverse profiles
3. find_matches returns relevant, filtered results
4. End-to-end flow works: intake → save → match
5. All tests pass

---

## Technical Notes

- Use existing Supabase API client for database operations
- Matching algorithm runs server-side, not in database
- Prompt arguments allow customization per interview session
