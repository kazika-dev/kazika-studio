# Cloud Run deployment

Kazika Studio deploys via Cloud Run. The repository no longer keeps Vercel deployment
configuration; use `Dockerfile.cloudrun` and `cloudbuild.cloudrun.yaml` for production deploys.

## One-time setup

Enable the required APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

Create a user-managed service account for Cloud Build. Do not use the legacy
`PROJECT_NUMBER@cloudbuild.gserviceaccount.com` account in a trigger's
`service_account` field; Cloud Build rejects that value for user-specified
service accounts.

Replace `PROJECT_ID` first.

```bash
PROJECT_ID=your-project-id
BUILD_SA=cloud-run-builder
BUILD_SA_EMAIL="${BUILD_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "${BUILD_SA}" \
  --project="${PROJECT_ID}" \
  --display-name="Cloud Run builder"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Needed because cloudbuild.cloudrun.yaml creates the Artifact Registry repo
# when it does not exist yet. After the repo exists, writer-level access is
# enough if you prefer to reduce permissions.
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA_EMAIL}" \
  --role="roles/artifactregistry.admin"
```

When creating a Cloud Build trigger, set **Service account** to the full
user-managed account resource:

```text
projects/PROJECT_ID/serviceAccounts/cloud-run-builder@PROJECT_ID.iam.gserviceaccount.com
```

Alternatively, leave the trigger service account field unset so Cloud Build
selects a default account. Do not enter the legacy Cloud Build default service
account manually.

## Deploy manually through Cloud Build

```bash
gcloud builds submit \
  --config cloudbuild.cloudrun.yaml \
  --substitutions _REGION=asia-northeast1,_SERVICE_NAME=kazika-studio,_AR_REPO=cloud-run \
  .
```

## Required runtime environment variables

Configure these on the Cloud Run service. Do not commit real values to Git.

- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `NEON_DB` or `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`
- `GEMINI_API_KEY`
- `GCP_STORAGE_BUCKET`
- `GCP_SERVICE_ACCOUNT_KEY` or the split variables used by some routes:
  `GCP_PROJECT_ID`, `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY`
- Optional feature keys: `ELEVENLABS_API_KEY`, `HIGGSFIELD_API_KEY`,
  `HIGGSFIELD_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `VERTEX_API_KEY`
- Recommended: `NEXT_PUBLIC_APP_URL=https://kazika-studio-vrdafz7ndq-an.a.run.app`

For an existing Cloud Run service, `gcloud run deploy` normally preserves current
environment variables. Set secrets once with `gcloud run services update` or the
Cloud Run console.

## Cloud Run Dockerfile behavior

`Dockerfile.cloudrun` builds Next.js with `NEXT_OUTPUT_STANDALONE=true`, which enables
Next's standalone server output for Cloud Run.
