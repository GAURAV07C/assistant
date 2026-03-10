# Improvement Plan (Next Upgrades)

Date: 2026-03-08

## Already Implemented Now

1. Personal reply-style adaptation
- Backend now applies profile/style hints before sending message to LLM.
- Impact: responses become more personal and aligned with user preference.

2. Daily digest + reminders
- New reminder APIs and daily digest API.
- Auto generation cycle runs periodically.
- Impact: assistant becomes proactive, not only reactive.

3. Memory confidence + stale cleanup
- Memory confidence scoring endpoint.
- Cleanup endpoint and automatic cleanup cycle.
- Impact: stale/low-quality memory drift reduces over time.

## Deferred Improvement (Requested #4)

4. Protected local auth layer (deferred)
- Why deferred: needs careful UX + token/session design + endpoint hardening.
- Recommended implementation:
  1. Local auth token bootstrap (`JARVIS_LOCAL_TOKEN`) in `.env`
  2. Middleware protection for critical routes:
     - `/workspace/*`
     - `/agent/execute`
     - `/memory/cleanup`
     - `/assistant/reminders*`
  3. Optional allowlist mode for localhost-only access.

## Additional High-Value Improvements

1. E2E regression pack
- Cover: chat stream, agent execute, skill evolve, workspace save, reminder flow.

2. Skill evolution scoring v2
- Add complexity-weighted and outcome-weighted scoring.

3. Digest intelligence v2
- Include failed audit patterns + pending critical tasks + next best action.

4. Security hardening for public deployment
- Rate limiting, authz rules, and stricter file write policy.
