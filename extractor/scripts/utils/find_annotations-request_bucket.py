"""Script pour rechercher des occurrences d'un ID vidéo dans les fichiers
annotations-request.jsonl d'un bucket GCS."""
import json
import logging
from datetime import datetime, UTC
import sys

from google.cloud import storage

BUCKET = "videoclub-test"
PREFIX = "work/"
VIDEO_ID = sys.argv[1]

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    client = storage.Client()
    matches: set[str] = set()
    inspected = 0

    logging.info("Recherche de '%s' dans gs://%s/%s*", VIDEO_ID, BUCKET, PREFIX)

    for blob in client.list_blobs(BUCKET, prefix=PREFIX):
        if not blob.name.endswith("annotations-request.jsonl"):
            continue

        inspected += 1
        if inspected % 25 == 0:
            logging.info("%d fichiers inspectés… dernier: %s", inspected, blob.name)

        # blob.name = "work/{ts}/annotations-request.jsonl" → extraire {ts}
        parts = blob.name.split("/")
        if len(parts) < 3:
            continue
        ts_folder = parts[1]

        with blob.open("rt") as fh:
            for line in fh:
                try:
                    payload = json.loads(line)
                    file_uri = payload["request"]["contents"][0]["parts"][0]["fileData"]["fileUri"]
                except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                    continue

                if VIDEO_ID in file_uri:
                    matches.add(ts_folder)
                    break  # on passe au fichier suivant

    if matches:
        print("Horodatages correspondants :")
        for ts_folder in sorted(matches):
            print(f"- {ts_folder} → {format_timestamp(ts_folder)}")
    else:
        print("Aucune occurrence trouvée.")

    logging.info("Analyse terminée, %d fichiers inspectés", inspected)


def format_timestamp(value: str) -> str:
    """Convertit un identifiant de dossier en date UTC lisible."""
    try:
        raw = int(value)
    except ValueError:
        return "format invalide"

    # Les dossiers sont généralement des timestamps en secondes ou millisecondes.
    for divisor in (1, 1_000, 1_000_000):
        seconds = raw / divisor
        try:
            dt = datetime.fromtimestamp(seconds, tz=UTC)
        except (OverflowError, OSError):
            continue

        if 2000 <= dt.year <= 2100:
            return dt.isoformat()

    return "date inconnue"

if __name__ == "__main__":
    main()
