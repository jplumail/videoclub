# Set up website rebuild automation

Automates the Firebase Hosting deployment of the [`web`](../web/) app whenever the `videoclub-rebuild-site` Pub/Sub topic receives a message. The associated Cloud Build pipeline calls the HTTP [`prepare_data`](../extractor/functions/prepare_data.py) function via `web/scripts/invoke_prepare_data.py` as its first step before compiling and deploying the static site. The topic is triggered both by the extractor pipeline and by pushes to the `main` branch on GitHub.

## 1. Pub/Sub topic

```bash
PROJECT_ID=videoclub-447210
TOPIC=videoclub-rebuild-site

gcloud pubsub topics describe ${TOPIC} \
  --project=${PROJECT_ID} \
|| gcloud pubsub topics create ${TOPIC} \
  --project=${PROJECT_ID}
```

Grant the Cloud Functions runtime service account publish access (replace with the value shown in the Functions UI if you use a custom one). For Gen 2 functions, the default is the Compute Engine default service account `PROJECT_NUMBER-compute@developer.gserviceaccount.com`:

```bash
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
FUNCTION_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud pubsub topics add-iam-policy-binding ${TOPIC} \
  --project=${PROJECT_ID} \
  --member="serviceAccount:${FUNCTION_SA}" \
  --role="roles/pubsub.publisher"
```

## 2. Deploy extractor

`extractor/functions/aggregator.py` publishes a JSON payload of the form `{ "bucket": "<bucket>", "ts": "<iso8601>" }` to the topic defined above.

Redeploy with the existing Cloud Build pipeline so that the `REBUILD_SITE_TOPIC` environment variable is set automatically:

```bash
# from /extractor
gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGION=europe-west9,_BUCKET=videoclub-test
```

### 3. Create the GitHub 2nd-gen connection

> The GitHub connection stores credentials in Secret Manager. Enable the API and grant the Cloud Build service agent permissions before creating the connection.

```bash
PROJECT_ID=videoclub-447210
REGION=europe-west9
CONNECTION_NAME=videoclub-github

gcloud services enable secretmanager.googleapis.com \
  --project=${PROJECT_ID}

PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
CLOUDBUILD_P4SA="service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${CLOUDBUILD_P4SA}" \
  --role="roles/secretmanager.admin"

gcloud builds connections create github ${CONNECTION_NAME} \
  --project=${PROJECT_ID} \
  --region=${REGION}
```

Follow the authorization link provided by the command to install the Cloud Build GitHub App on the desired org/user, then create the repository mapping:

```bash
REPO_NAME=videoclub
OWNER=jplumail

gcloud builds repositories create ${REPO_NAME} \
  --project=${PROJECT_ID} \
  --region=${REGION} \
  --connection=${CONNECTION_NAME} \
  --remote-uri=https://github.com/${OWNER}/${REPO_NAME}.git
```

Once the connection exists, reference the repository via `projects/${PROJECT_ID}/locations/${REGION}/connections/${CONNECTION_NAME}/repositories/${REPO_NAME}` in the trigger command above.

## 4. Cloud Build trigger for the web app

Create (or update) a Pub/Sub trigger that points at `web/cloudbuild.yaml` using a 2nd‑generation repository connection:

```bash
PROJECT_ID=videoclub-447210
REGION=europe-west9                        # region of the Cloud Build connection + functions
TRIGGER_NAME=videoclub-web-rebuild
TOPIC=projects/${PROJECT_ID}/topics/videoclub-rebuild-site
CONNECTION_NAME=videoclub-github           # name of your Cloud Build connection
REPO_NAME=videoclub                        # repo registered within that connection
SERVICE_ACCOUNT_ID=cloudbuild-web          # user-managed SA dedicated to builds
CLOUDBUILD_SA="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud builds triggers create pubsub \
  --project=${PROJECT_ID} \
  --region=${REGION} \
  --name=${TRIGGER_NAME} \
  --topic=${TOPIC} \
  --repository=projects/${PROJECT_ID}/locations/${REGION}/connections/${CONNECTION_NAME}/repositories/${REPO_NAME} \
  --branch=main \
  --build-config=web/cloudbuild.yaml \
  --substitutions=_FIREBASE_PROJECT_ID=${PROJECT_ID},_DATA_BUCKET=videoclub-test,_GCP_PROJECT=${PROJECT_ID},_FUNCTION_REGION=${REGION} \
  --service-account=projects/${PROJECT_ID}/serviceAccounts/${CLOUDBUILD_SA}
```

Cloud Build fetches the latest revision of the specified branch for each trigger event so the deployment always uses a consistent commit snapshot.

> Cloud Build 2nd-gen triggers reject the default project-number@cloudbuild.gserviceaccount.com identity. Create and supply your own service account (next section) instead.

## 5. IAM for Cloud Build

Create (or confirm) the user-managed service account and grant the required roles:

```bash
PROJECT_ID=videoclub-447210
SERVICE_ACCOUNT_ID=cloudbuild-web
CLOUDBUILD_SA="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
CLOUDBUILD_P4SA="service-${PROJECT_NUMBER}@gcp-sa-cloudbuild.iam.gserviceaccount.com"

gcloud iam service-accounts create ${SERVICE_ACCOUNT_ID} \
  --project=${PROJECT_ID} \
  --display-name="Cloud Build web builder"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/firebasehosting.admin"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/cloudfunctions.invoker"

gcloud iam service-accounts add-iam-policy-binding ${CLOUDBUILD_SA} \
  --project=${PROJECT_ID} \
  --member="serviceAccount:${CLOUDBUILD_P4SA}" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Allow GitHub Actions (repo jplumail/videoclub) to impersonate the build service account via Workload Identity Federation.
```bash
gcloud iam service-accounts add-iam-policy-binding ${CLOUDBUILD_SA} \
  --project=${PROJECT_ID} \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/jplumail/videoclub" \
  --role="roles/iam.workloadIdentityUser"

gcloud iam service-accounts add-iam-policy-binding ${CLOUDBUILD_SA} \
  --project=${PROJECT_ID} \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/jplumail/videoclub" \
  --role="roles/iam.serviceAccountUser"
# Required so the federated identity can set itself as the Cloud Build trigger service account when invoking builds.
```

Grant additional roles (Secret Manager access, Artifact Registry, etc.) if your build steps need them.

## 6. Manual end-to-end test

Publish a message once everything is wired:

```bash
gcloud pubsub topics publish videoclub-rebuild-site \
  --message='{"bucket":"videoclub-test"}'

# Verify that the trigger exists and is pointing at the expected config:

gcloud builds triggers describe ${TRIGGER_NAME} \
  --project=${PROJECT_ID} \
  --region=${REGION}
```

Watch Cloud Build for a successful run and confirm that Firebase Hosting deploys the latest build.
