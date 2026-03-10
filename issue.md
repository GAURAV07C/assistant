# TS Backend Current Status and Issues (Memory + Long-Term Recall)

Date: 2026-03-09
Scope: TypeScript backend only (`ts-backend`), Python ignored.

## 1) Current Reality (What exists now)

- Persistent chat storage exists:
  - Session chats are saved in `database/chats_data/chat_<session_id>.json`
  - Implemented in `ts-backend/src/services/chatService.ts` (`saveChatSession`, `loadSessionFromDisk`)
- Active session persistence exists:
  - `database/memory_data/active_session.json`
  - Implemented in `ts-backend/src/server.ts`
- Learning dataset persistence exists:
  - `database/dataset/daily_logs/*.jsonl`
  - `database/dataset/conversation_history/*.jsonl`
  - Implemented in `ts-backend/src/learning/dataset_manager.ts`
- Learning scheduler pipeline exists:
  - ingestion -> extraction -> embeddings -> graph -> behavior
  - Implemented in `ts-backend/src/learning/learning_scheduler.ts`
- Profile/personal memory storage exists:
  - `database/memory_data/profile_memory.json`, `memory_store.json`
  - plus structured files under `database/profiles`, `database/coding_style`, etc.
  - Implemented in `ts-backend/src/core/memory/memoryService.ts`

## 2) Main Issue (Why 1-year recall is not reliable in normal chat)

### Issue A: Runtime chat context is capped to recent turns
- `MAX_CHAT_HISTORY_TURNS = 20`
- File: `ts-backend/src/config.ts`
- Impact:
  - Very old conversation facts are often not included in model context.
  - Even if data exists on disk, response may miss old details.

### Issue B: Learning dataset is stored but not strongly injected into every response
- Chat answer path uses BrainRouter + LLM with recent history.
- Dataset/knowledge files are not guaranteed to be semantically retrieved and appended for each user prompt.
- Impact:
  - “Stored memory” != “always used memory”.

### Issue C: Memory profile is available, but automatic fact lifecycle is limited
- There is no strict, always-on pipeline that extracts personal facts from every chat and prioritizes them at inference time.
- Impact:
  - Preferences/goals can be inconsistent in long-term recall unless manually upserted or recently discussed.

## 3) User-Facing Behavior Right Now

- If you ask something again after a long time:
  - It may remember if same session/history is still loaded and relevant.
  - It may forget if the fact is old, outside recent turns, or not in prompt context.

## 4) Severity

- Functional memory persistence: ✅ Present
- Reliable 1-year personal recall in normal chat: ⚠️ Partial / Not guaranteed

## 5) Required Fixes (TS only)

1. Add mandatory semantic retrieval on every chat request:
   - query vector memory + conversation history + profile memory
   - inject top-K recalled facts into final prompt context
2. Add personal fact extractor:
   - auto-detect name, preferences, goals, constraints from chat
   - upsert into profile memory with confidence score
3. Add memory ranking policy:
   - priority: explicit profile facts > recent session facts > semantic history
4. Add recall audit endpoint:
   - test query -> show which memories were retrieved and used
5. Increase continuity fallback:
   - when session changes, include cross-session recall block automatically

## 6) Conclusion

TS backend already has strong storage and learning foundations.
The gap is not storage; the gap is inference-time memory retrieval enforcement.
After retrieval enforcement + fact extraction, long-term recall can become reliable.
