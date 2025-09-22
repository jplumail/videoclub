# Extractor pipeline

The extractor pipeline keeps the video dataset in Google Cloud Storage fresh so the website build always has up-to-date inputs. A Cloud Scheduler job calls the `discover` function on a cadence, and the downstream Cloud Functions populate the bucket and notify the web deployment.

## Flow overview

1. **Cloud Scheduler → discover** – Scheduler performs an HTTP `GET` on `discover`, passing the target bucket. The function scans the Videoclub playlist, ensures the Pub/Sub topic exists, and creates a batch document in Firestore.
2. **discover → Pub/Sub (`videoclub-new-video`)** – Each video missing artifacts results in a Pub/Sub message with the video ID and bucket.
3. **processor** – The Pub/Sub-triggered function runs `get_infos`, `annotate`, and `extract` for each video, writing JSON and media artifacts under `gs://<bucket>/videos/<video-id>/`.
4. **aggregator → prepare_data** – Firestore updates from finished batches trigger `aggregator`, which calls the HTTP `prepare_data` function. `prepare_data` compiles the site-wide dataset in the same bucket and publishes a rebuild message to `videoclub-rebuild-site` so the website build can run.

That rebuild trigger is consumed by the web Cloud Build pipeline described in `docs/rebuild-automation.md`.

## Set up the discover scheduler

```bash
PROJECT_ID=videoclub-447210
REGION=europe-west9

DISCOVER_URL=$(gcloud functions describe discover \
  --project=${PROJECT_ID} \
  --region=${REGION} \
  --gen2 \
  --format='value(serviceConfig.uri)')
```

`DISCOVER_URL` is the HTTPS endpoint exposed by the function. Update the region if you deployed the function elsewhere.

```bash
SCHEDULER_LOCATION=europe-west1
SCHEDULER_JOB=videoclub-discover
SCHEDULE="0 */2 * * *"
BUCKET=videoclub-test

gcloud scheduler jobs create http ${SCHEDULER_JOB} \
  --project=${PROJECT_ID} \
  --location=${SCHEDULER_LOCATION} \
  --schedule="${SCHEDULE}" \
  --uri="${DISCOVER_URL}?bucket=${BUCKET}" \
  --http-method=GET
```

Adjust `SCHEDULE` to match the frequency you want the extractor pipeline to run. The default above runs every two hours.

```bash
gcloud scheduler jobs run ${SCHEDULER_JOB} \
  --project=${PROJECT_ID} \
  --location=${SCHEDULER_LOCATION}
```

Use the Cloud Scheduler console to verify invocations succeed, or review Cloud Logging for the `discover` function.

## Update the scheduler

```bash
gcloud scheduler jobs update http ${SCHEDULER_JOB} \
  --project=${PROJECT_ID} \
  --location=${SCHEDULER_LOCATION} \
  --schedule="${SCHEDULE}" \
  --uri="${DISCOVER_URL}?bucket=${BUCKET}" \
  --http-method=GET
```