# Usage

Lancer les scripts:
```bash
# Cibler des vidéos spécifiques en listant les IDs YouTube
uv run ./scripts/get_infos_videos.py dQw4w9WgXcQ abc123   # crée /videos/{id}/video.json et thumbnail.jpg
uv run ./scripts/annotate_videos.py dQw4w9WgXcQ.          # crée /videos/{id}/annotations.json
uv run ./scripts/extract_movies_videos.py abc123 def456   # crée /videos/{id}/movies.json

# --all pour toute la playlist
uv run ./scripts/get_infos_videos.py --all
uv run ./scripts/annotate_videos.py --all
uv run ./scripts/extract_movies_videos.py --all
```

```bash
uv run ./scripts/prepare_data.py  # crée des fichiers dans /data/ pour le site
```

Notes:
- `prepare_data.py` n'accepte pas d'IDs: il opère toujours sur toutes les vidéos.

# Dev

Générer les types pour le frontend:

```sh
uv run --with pydantic-to-typescript pydantic2ts --module extractor/models.py --output ../web/lib/backend/types.ts
```

## Linting

Ce repo utilise Ruff pour le lint (configuré dans `pyproject.toml`).

- Vérifier le code: `uv run ruff check .`
- Corriger automatiquement: `uv run ruff check . --fix`
