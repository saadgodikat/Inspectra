# Inspectra Buildathon Readiness Roadmap

This roadmap turns the six improvement areas identified in the Buildathon 2.0 review into an ordered plan. Each phase describes the current gap, why it matters, practical steps to address it, and evidence that the phase is complete.

The goal is not to add more screens for their own sake. The goal is to demonstrate one reliable, traceable quality workflow that connects inspection evidence, human decisions, corrective work, follow-up, and batch disposition.

## Phase 1 — Complete the inspection-to-corrective-action workflow

### Problem

The application has backend records and endpoints for reviews, defects, corrective actions, and repair evidence, but the main user-facing workflow does not clearly guide a user through the full journey. Reinspection and its relationship to the original issue also need to be easy to see. This risks making the application feel like separate tabs rather than one connected system.

### Steps

1. **Map the existing records and APIs.** Confirm how an inspection, item result, human review, defect, corrective action, evidence upload, and reinspection are linked. Reuse the existing backend behavior where it is sound.
2. **Add a clear review action to inspection results.** Let an authorized user confirm the model suggestion, correct it, record no defect, or request more evidence. Capture the reviewer and decision reason/comment.
3. **Make confirmed defects actionable.** From a defect, let an authorized supervisor or Quality Manager create an action with an owner, target date, and notes.
4. **Expose corrective-action progress.** Show action status and repair evidence in the defect detail or a closely linked action view. Preserve earlier evidence and decisions.
5. **Connect follow-up inspections.** Let a user start a reinspection from an action or defect and show its link to the original inspection. Keep the original attempt visible.
6. **Support closure and recurrence.** Allow an authorized user to close or reopen the issue after reviewing the follow-up result; do not erase the original defect or its history.

### Completion evidence

- A judge can follow one example from image upload through human review, confirmed defect, assigned action, repair evidence, reinspection, and close/reopen.
- Human decisions remain separate from ML predictions.
- The database and APIs retain the original inspection, evidence, decisions, and follow-up links.

## Phase 2 — Make batch hold/release a real, traceable decision

### Problem

The release interface presents a PIN and electronic-signature language, but the PIN is not verified by the backend and the current UI status update does not appear to use the separate batch-decision workflow that records a decision and its inspection/defect snapshot. A release action can also be presented without clearly showing the quality evidence being considered. This weakens trust in the most consequential action on the page.

### Steps

1. **Use the batch-decision endpoint from the release interface.** Submit the batch, decision, reason, and relevant signature meaning through the decision workflow rather than only changing a status field.
2. **Show decision context before confirmation.** Display linked inspection counts, reviewed counts, confirmed defects, open actions, and relevant current batch status where available. Clearly identify missing or incomplete evidence.
3. **Define the release policy explicitly.** Decide which conditions are advisory and which block release for this prototype. Implement the chosen rules server-side and explain them in the UI; do not silently invent a policy or treat one inspected sample as proof of the entire batch.
4. **Remove misleading authentication claims.** Either remove the PIN/signature language and use the authenticated Quality Manager session with a reason, or implement and test genuine backend re-authentication. Do not claim legal equivalence or cryptographic sealing unless those controls truly exist.
5. **Enforce permissions and valid transitions on the backend.** Test that unauthorized roles cannot release a batch and that invalid or repeated decisions are handled clearly.
6. **Show the recorded decision afterwards.** Present who decided, when, why, the status transition, and the decision-time evidence snapshot.

### Completion evidence

- A release creates a durable batch-decision record and audit event with the actor, reason, timestamp, and decision-time counts.
- Backend tests prove that unauthorized users cannot perform a release and that any declared release gate cannot be bypassed through a direct API call.
- The UI's signature and compliance wording accurately describes the implemented controls.

## Phase 3 — Align inspection status, telemetry, and quality metrics

### Problem

Some inspection-list values are simplified or hard-coded and may not match persisted item-level results. Station labels and live-telemetry language can imply a real station integration when the app does not store station records. Dashboard metrics can also mislead if status, yield, or defect counts use inconsistent sources or unclear denominators.

### Steps

1. **Define each displayed metric.** Document what counts as an inspection, inspected item, reviewed item, confirmed defect, pending result, and first-pass yield. State the denominator beside each rate.
2. **Use persisted data as the source of truth.** Derive each run's status and item/defect counts from the stored inspection and item results, not placeholder values or assumptions based only on inspection status.
3. **Separate AI flags from confirmed defects.** Label model suggestions as unreviewed predictions and count confirmed defects only after the appropriate human decision.
4. **Remove or label simulated telemetry.** If station data is not collected, remove claims such as live polling/calibration and avoid assigning a fixed station to every run. If station attribution is part of the demo, store it explicitly and show its source.
5. **Count physical items, not image files.** Ensure multiple images of an item do not inflate inspection or defect counts. Handle missing/unreviewed items explicitly.
6. **Make shared views agree.** Check the same batch and inspection across Inspections, Defect Tracker, Batch Releases, Command Center, and Analytics; refresh data after mutations.

### Completion evidence

- A seeded example with known item counts produces the same understandable status and counts wherever it appears.
- Metric labels explain their numerator and denominator; predictions and confirmed outcomes are visibly distinct.
- The UI does not present simulated station or calibration information as live operational data.

## Phase 4 — Verify and present credible ML evidence

### Problem

The repository includes dataset, split, training, and evaluation reports, but the reports are not fully consistent: the dataset audit describes cross-split duplicates while the split report says leakage was removed, and some error examples in the held-out report appear to reference training paths. Documentation also describes parts of the ML pipeline as future work despite reports showing completed runs. These inconsistencies make it difficult for judges to trust or reproduce the metrics.

### Steps

1. **Reproduce the evaluation from the checked-in split manifests.** Verify the checkpoint, dataset version, label mapping, preprocessing, threshold-selection procedure, and exact files evaluated.
2. **Audit leakage and test-set provenance.** Confirm that exact duplicates and known related images do not cross train/validation/test splits. Correct any report rows that are not held-out test examples.
3. **Regenerate reports from evaluation outputs.** Publish sample counts, class counts, confusion matrix, per-class precision/recall/F1, and representative successes and failures from the correct split.
4. **Reconcile ML documentation.** Make `ml/README.md`, dataset/split reports, training/evaluation reports, and the application integration describe one consistent pipeline and model.
5. **Verify runtime inference.** Demonstrate that the application loads the intended checkpoint and stores the predicted class, score semantics when available, model/version, processing time, and failures.
6. **Explain model limits.** State that the model performs the supported binary task only; predictions are review suggestions, not human-confirmed findings or batch-release decisions.

### Completion evidence

- A clean, reproducible command or documented sequence generates the reported held-out metrics from the stated manifest and checkpoint.
- Every reported error example belongs to the stated evaluation split.
- The application can show an actual stored prediction and handle unavailable weights, unreadable images, or inference failure without losing the inspection record.

## Phase 5 — Ground the assistant in permitted, current records

### Problem

The project-data assistant is a useful feature, but a chat interface alone does not satisfy the brief's requirement for a grounded batch summary or question-answering capability. Answers must distinguish predictions from confirmed findings, cite source records, disclose missing evidence, and respect each user's permissions.

### Steps

1. **Define supported questions and source records.** Prioritize batch summaries, current holds, pending reviews, confirmed defects, open corrective actions, and recurrence/follow-up questions.
2. **Compute exact counts in code or database queries.** Do not ask the language model to estimate totals or infer status from partial text.
3. **Retrieve only authorized records.** Enforce permissions before passing context to the model; treat uploaded notes and evidence as untrusted data, not instructions.
4. **Require citations and evidence distinctions.** Cite inspection, defect, action, and batch decision IDs or links. Mark prediction, human-confirmed outcome, and generated suggestion separately.
5. **Handle unknown and incomplete cases honestly.** Say when the batch is unknown, relevant records are missing, or the available data cannot answer the question. Do not fabricate causes or assume recurrence.
6. **Test adversarial and boundary questions.** Cover a supported request, unknown batch, misleading premise, unauthorized-data request, and prompt-like instructions embedded in record content.

### Completion evidence

- Demo answers cite the actual records used and match database-computed counts.
- An unauthorized request reveals no restricted records, and a misleading premise is corrected rather than repeated.
- The assistant cannot release a batch, close an action, or replace a human review.

## Phase 6 — Prove recovery, authorization, and a measured innovation

### Problem

The final demonstration must show more than a successful happy path. The brief asks teams to demonstrate exception handling and recovery, an unauthorized action being refused, and one team-designed improvement with evidence of value. Without these, a broad feature set may look like a conventional dashboard rather than a tested solution to the stated problem.

### Steps

1. **Prepare exception scenarios.** Include an unreadable/unsupported image, failed or unavailable model inference, missing item evidence, and an inspection that needs more evidence.
2. **Show safe recovery.** Demonstrate retry or manual review without losing the inspection, original file reference, prior model attempt, or human decision history.
3. **Test authorization failures.** Attempt a restricted action as an Inspector or Supervisor and show that the backend refuses it; do not rely only on hiding the button.
4. **Choose one focused innovation.** Examples include a transparent review-priority queue, a before/after evidence comparison, or a recurrence view based on linked records. Choose one that solves a real user problem and can be finished reliably.
5. **Measure its value.** Define a small, repeatable test before presenting the feature—for example, time to identify high-priority cases, reviewer agreement, or number of required clicks—and report the baseline and result without overstating the sample.
6. **Prepare a judge-ready demonstration.** Seed clearly fictional data and rehearse product/batch creation, unseen image upload, stored prediction, human review, action and reinspection, batch decision, history/dashboard, cited assistant answer, one failure/recovery, one denied action, and the innovation measurement.
7. **Complete handoff materials.** Ensure setup instructions, demo accounts, seed commands, API/schema or architecture overview, model/dataset provenance, evaluation results, and limitations agree with the implementation.

### Completion evidence

- The team can run the complete demonstration locally from documented setup steps.
- The normal path, recovery path, permission refusal, and innovation test work on the current build.
- The innovation claim is supported by a disclosed measurement, and all sample workflow data is identified as fictional.

## Recommended execution order

Complete the phases in order where practical:

1. Phase 1 establishes the end-to-end records and user journey.
2. Phase 2 makes the consequential batch decision use that evidence responsibly.
3. Phase 3 makes screens and metrics tell a consistent story.
4. Phase 4 verifies the ML evidence used in the workflow.
5. Phase 5 builds trustworthy, cited summaries over the resulting records.
6. Phase 6 validates the complete system and prepares the final demonstration.

If time is limited, prioritize a small, fully connected scenario over broadening product support or adding optional infrastructure. The model, assistant, and dashboard should support the human quality workflow—not substitute for it.
