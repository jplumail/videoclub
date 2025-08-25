from pydantic import BaseModel
from themoviedb import Person
from ..youtube.models import PlaylistItem


class PlaylistItemPersonnalites(BaseModel):
    playlist_item: PlaylistItem
    personnalites: list[Person | None]
