# Extractor pipeline

The extractor pipeline keeps the video dataset in Google Cloud Storage fresh so the website build always has up-to-date inputs. A Cloud Scheduler job calls the `discover` function on a cadence, and the downstream Cloud Functions populate the bucket and notify the web deployment.

## Flow overview

1. **Cloud Scheduler → discover** – Scheduler performs an HTTP `GET` on `discover`, passing the target bucket. The function scans the Videoclub playlist, ensures the Pub/Sub topic exists, and creates a batch document in Firestore.
2. **discover → Pub/Sub (`videoclub-new-video`)** – Each video missing artifacts results in a Pub/Sub message with the video ID and bucket.
3. **processor** – The Pub/Sub-triggered function runs `get_infos`, `annotate`, and `extract` for each video, writing JSON and media artifacts under `gs://<bucket>/videos/<video-id>/`.
4. **aggregator → prepare_data** – Firestore updates from finished batches trigger `aggregator`, which calls the `prepare_data` function. `prepare_data` compiles the site-wide dataset in the same bucket and publishes a rebuild message to `videoclub-rebuild-site` so the website build can run.

That rebuild trigger is consumed by the web Cloud Build pipeline described in `docs/rebuild-automation.md`.

## Set up

### Discover scheduler

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

#### Update the discover scheduler

```bash
gcloud scheduler jobs update http ${SCHEDULER_JOB} \
  --project=${PROJECT_ID} \
  --location=${SCHEDULER_LOCATION} \
  --schedule="${SCHEDULE}" \
  --uri="${DISCOVER_URL}?bucket=${BUCKET}" \
  --http-method=GET
```

### Create the Pub/Sub topics

```bash
gcloud pubsub topics create videoclub-processor
gcloud pubsub topics create videoclub-prepare-data
```

## Manual pipeline triggers

### Trigger the whole pipeline manually

If you don't use the scheduler:
```bash
curl -sS "https://europe-west9-videoclub-447210.cloudfunctions.net/discover?bucket=videoclub-test"
```

### Annotate video(s) manually

Sometimes the annotation process fails with Gemini Flash, it might be a solution to use the Pro model. Here we annotate `PzkE22ys4-g` video with unlimited thinking budget with the Pro model with `annotate_videos.py`. Annotation is stored in the default bucket.

```bash
uv run ./scripts/annotate_videos.py --model gemini-2.5-pro PzkE22ys4-g --thinking-budget -1
```

Then, we need to extract TMDB movies from the annnotations. To do it manually, use the `extract_movies_videos.py` script. A `movies.json` will be stored in the default bucket.

```bash
uv run ./scripts/extract_movies_videos.py PzkE22ys4-g
```

Before rebuilding the website, we need to transform data to be used by the website builder: from the `/videos` prefix into the `/data` prefix. We use `prepare_data.py` for that:

```bash
uv run ./scripts/prepare_data.py
```

Now we can trigger the build of the NextJS website which will use `/data` in the bucket.

```bash
gcloud pubsub topics publish videoclub-rebuild-site \
  --message='{"bucket":"videoclub-test"}'
```