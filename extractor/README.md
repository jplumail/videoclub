# Usage

Lancer les scripts:
```bash
# Cibler des vidéos spécifiques en listant les IDs YouTube
uv run ./scripts/get_infos_videos.py dQw4w9WgXcQ abc123                 # crée /videos/{id}/video.json et thumbnail.jpg
uv run ./scripts/annotate_videos.py dQw4w9WgXcQ                         # crée /videos/{id}/annotations.json
uv run ./scripts/extract_movies_videos.py abc123 def456                 # crée /videos/{id}/movies.json

# --all pour toute la playlist
uv run ./scripts/get_infos_videos.py --all
uv run ./scripts/annotate_videos.py --all
uv run ./scripts/extract_movies_videos.py --all

# Optionnel: changer le bucket (défaut: videoclub-test)
uv run ./scripts/get_infos_videos.py --bucket videoclub-prod --all
uv run ./scripts/annotate_videos.py --bucket videoclub-prod dQw4w9WgXcQ
uv run ./scripts/extract_movies_videos.py --bucket videoclub-prod abc123

# Vérifier si un ID est traité (sortie 0 si OK, 1 sinon)
uv run ./scripts/check_processed_video.py HLUe85q1hNM --bucket videoclub-test
```

```bash
uv run ./scripts/prepare_data.py  # crée des fichiers dans /data/ pour le site
```

Notes:
- `prepare_data.py` n'accepte pas d'IDs: il opère toujours sur toutes les vidéos.
- Les scripts `get_infos_videos.py`, `annotate_videos.py`, `extract_movies_videos.py` requièrent `--all` ou au moins un ID. Sans argument, une erreur est levée.
- Tous acceptent `--bucket <name>` (par défaut `videoclub-test`).

# Dev

Générer les types pour le frontend:

```sh
uv run --with pydantic-to-typescript pydantic2ts --module extractor/models.py --output ../web/lib/backend/types.ts
```

## Linting

Ce repo utilise Ruff pour le lint (configuré dans `pyproject.toml`).

- Vérifier le code: `uv run ruff check .`
- Corriger automatiquement: `uv run ruff check . --fix`

## Déploiement (Cloud Build)

Déployer les Cloud Functions via Cloud Build:

```bash
gcloud builds submit --config=cloudbuild.yaml
```

Optionnel: surcharger les substitutions (si nécessaire):

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions _REGION=europe-west9,_TOPIC=videoclub-new-video
```

## Orchestration Fan-Out/Fan-In

- L'appel HTTP à `discover` crée un `batch_id` et publie un message Pub/Sub par vidéo manquante avec des attributs `batch_id`, `video_id`, `bucket`.
- Chaque exécution `processor` traite un ID et incrémente de façon idempotente `completed` dans Firestore (`batches/{batch_id}`) via un document sentinelle `done/{video_id}`.
- La fonction `aggregator` (déclencheur Firestore) observe `batches/{batch_id}` et, quand `completed + failed == total`, marque `status=done` et appelle la Cloud Function HTTP `prepare_data` pour générer `/data/*` dans le bucket.

Appel manuel de la fonction `prepare_data` :

```bash
curl -H 'Content-Type: application/json' \
     -d '{"bucket":"videoclub-test"}' \
"$(gcloud functions describe prepare_data --gen2 --region ${REGION} --format='value(serviceConfig.uri)')"
```

### Blacklist de vidéos

Pour ignorer des IDs qui échouent systématiquement, utilisez la collection Firestore `blacklist` (via la console Firebase/Firestore) avec des documents contenant le champ `video_id` (string).

Alternatives en ligne de commande:
- Script utilitaire (recommandé):

```bash
# Lister
uv run ./scripts/manage_blacklist.py list

# Ajouter
uv run ./scripts/manage_blacklist.py add dQw4w9WgXcQ

# Supprimer
uv run ./scripts/manage_blacklist.py remove dQw4w9WgXcQ
```

- Variable d'env côté fonction `discover` (complémentaire): `BLACKLIST_IDS=dQw4w9WgXcQ,abc123`

`discover` lit la collection (champ `video_id`) et la variable d'env pour exclure ces vidéos des publications.
