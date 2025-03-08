Générer les types pour le frontend:

```sh
uv run --with pydantic-to-typescript pydantic2ts --module extractor/models.py --output ../web/lib/backend/types.ts
```

Lancer les scripts:
```bash
uv run ./scripts/get_infos_all_videos.py  # create /videos/{id}/video.json and thumbnail.jpg
uv run ./scripts/annotate_all_videos.py  # create /videos/{id}/annotations.json
uv run ./scripts/extract_all_movies.py  # create /videos/{id}/movies.json
```