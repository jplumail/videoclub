# Gemini Annotation Asynchronous Plan

## Problem Recap
- `processor` Cloud Function launches Gemini annotations (`annotate_all_videos`) and then blocks in a polling loop waiting for Gemini to finish.
- While mostly idle, the function still counts toward the 540 s Cloud Functions timeout, causing deployments to fail once we converted to an event trigger with a longer runtime.
- Most of the end-to-end duration is the Gemini wait, not local processing.

## Goal
Shorten `processor` runtime by splitting responsibilities into two Gen2 Cloud Functions that coordinate asynchronously:
1. A kickoff function that launches Gemini, records state, publishes the follow-up check, and then exits immediately.
2. A checker/resume function that repeatedly polls via Pub/Sub retries, throws errors while Gemini is still running, and when complete performs extraction plus Firestore bookkeeping.
3. Preserve current downstream triggers (aggregator, prepare-data) without introducing long-lived Cloud Function executions.

## Proposed Architecture
```
ingest topic ─▶ Processor Kickoff ─▶ Firestore doc (status = running)
                                  └▶ check topic (Pub/Sub backoff)
check topic ─▶ Checker + Resume ─▶
   • Gemini running  → throw retry error (Pub/Sub exponential backoff)
   • Gemini finished → update Firestore + run extraction/aggregation
```

### Components
1. **Processor Kickoff Function**
   - Dedicated Cloud Function triggered by the original ingest topic.
   - Decode Pub/Sub message → get `video_id`, `bucket`, `batch_id`.
   - Run `get_infos` as today (fast/local work).
   - Call Gemini once, capture the BatchJob resource name.
   - Upsert Firestore job doc at `batches/{batch_id}/annotation_jobs/{video_id}` with `job_id`, `status="running"`, `attempt=0`, `created_at`, `updated_at` using merge semantics so retries never overwrite terminal states.
   - Publish a follow-up message to the checker topic (e.g., `videoclub-annotation-check`) containing identifiers plus `job_id`; routing can rely on topic separation rather than message attributes.
   - Rely on the subscription’s retry policy (minimum + maximum delay) to space out retries instead of custom delay infrastructure. Timing is approximate; jitter is acceptable because the Gemini poller only needs eventual rechecks.
   - Return immediately (no long wait).

2. **Annotation Checker + Resume Function**
   - Triggered by the checker topic subscription that redelivers messages with exponential backoff.
   - Read the Firestore job doc first; if status is already terminal (`extracted` or `failed`), ack immediately for idempotency.
   - Query Gemini status (timing tolerance baked in since Pub/Sub exponential backoff is not precise):
     - If `running`: in a Firestore transaction increment `attempt`, refresh `updated_at`, keep `status="running"`, then throw a retryable error so Pub/Sub redelivers (configured min `4s`, max `240s`, ≈20 min total over 10 attempts).
     - If `succeeded`: write annotation output metadata (e.g., blob path) and transition to `status="succeeded"` before running extraction.
     - If Gemini returns a terminal error: set `status="failed"` with `error_reason`, `updated_at`, and log for follow-up; later deliveries short-circuit.
   - After successful extraction, finalize the same doc (transaction or conditional update) with `status="extracted"`, `updated_at`, and any bookkeeping fields (`annotation_blob`, `extracted_at`). Duplicate deliveries observe the terminal status and skip work.

3. **Aggregator Compatibility**
   - Checker + Resume function is responsible for updating batch completion counters in Firestore transactionally before triggering the existing aggregator flow.
   - Aggregator still publishes to prepare-data when the batch is done; no schema changes expected.

## Implementation Steps
1. **Refactor Processor Logic**
   - Split the current processor into two Cloud Functions: kickoff (existing trigger) and checker+resume (new trigger/topic).
   - Extract shared helpers (`update_batch_completion`, Firestore utilities) for reuse, and remove branching logic from the kickoff path.

2. **Create Firestore Schema & Helpers**
   - Define subcollection `batches/{batch_id}/annotation_jobs/{video_id}` with fields for `job_id`, `status`, `attempt`, timestamps, `annotation_blob`, `error_reason`.
   - Provide helper methods for merge-upserting kickoff docs and transactional updates that enforce valid status transitions (`running → succeeded → extracted` or `running → failed`).

3. **Configure Annotation-Check Subscription Retry Policy**
   - Create a dedicated Pub/Sub subscription (pull or push to checker function) with exponential backoff configured to `min_retry_delay = 4 s`, `max_retry_delay = 240 s` and allow 10 delivery attempts (≈20 min total wait). Precision is not required—Pub/Sub jitter is acceptable.
   - Ensure the checker function’s service account has Pub/Sub Subscriber role (and Publisher only if it needs to emit new messages later).

4. **Implement Checker + Resume Function**
   - New Gen2 Cloud Function subscribed to `videoclub-annotation-check`.
   - On each invocation: read Firestore doc, branch on status, query Gemini, update doc/attempt counters transactionally, throw to retry when still running.
   - When Gemini succeeds, run extraction immediately, then mark the doc `extracted` and update batch counters before acking.

5. **Wire Aggregator Updates**
   - Ensure the checker+resume function updates batch-level completion metrics (Firestore counters, Pub/Sub notifications) exactly once.
   - Verify existing aggregator/prepare-data triggers still observe the expected Firestore fields.

6. **Timeout Safety**
   - Keep both Cloud Functions (kickoff and checker+resume) under ≤ 120 s per invocation even under load.
   - Checker+resume handler should poll Gemini quickly then exit; each invocation remains short before Pub/Sub retry takes over.

7. **Update Cloud Build & Config**
   - Ensure deployment includes new checker function.
   - Grant necessary IAM roles (Cloud Tasks Enqueuer, Gemini API access) to service accounts.

8. **Testing & Rollout**
   - Unit-test helpers for Firestore job doc updates.
   - In staging: run end-to-end batch, verify Firestore transitions, aggregator triggers, and no timeouts.

## Open Items / Decisions Needed
- Tune Pub/Sub retry policy parameters (min/max backoff, max delivery attempts) to balance responsiveness vs. cost.
- Decide how to represent annotation output (store full response in Firestore vs GCS blob link).
- Define maximum wait time before declaring Gemini failure (e.g., 15 minutes?) and how aggregator should surface that.
- Determine whether resume pipeline should feedback to kickoff for retries (e.g., restart Gemini if extraction fails).

## Benefits
- Eliminates long-lived Cloud Function calls and the 540 s timeout issue.
- Scales better: Gemini waits no longer consume function concurrency.
- Clear visibility into annotation progress via Firestore docs.
- Minimal architectural upheaval; preserves current Pub/Sub-driven design.
