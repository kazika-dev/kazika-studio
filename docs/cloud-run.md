# Cloud Run deployment

Kazika Studio keeps the Vercel deployment settings unchanged. Cloud Run uses the
separate `Dockerfile.cloudrun` and `cloudbuild.cloudrun.yaml` files.

## One-time setup

Enable the required APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

Give the Cloud Build service account permission to deploy Cloud Run. Replace
`PROJECT_ID` and `PROJECT_NUMBER` first.

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

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
- Recommended: `NEXT_PUBLIC_APP_URL=https://YOUR-CLOUD-RUN-URL`

For an existing Cloud Run service, `gcloud run deploy` normally preserves current
environment variables. Set secrets once with `gcloud run services update` or the
Cloud Run console.

## Why a separate Dockerfile?

`Dockerfile.cloudrun` builds Next.js with `NEXT_OUTPUT_STANDALONE=true`, which
enables Next's standalone server output only for Cloud Run. Vercel builds do not
set that variable, so Vercel behavior remains unchanged.
