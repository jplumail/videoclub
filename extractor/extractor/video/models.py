from pydantic import BaseModel
from typing import List, Union
from themoviedb import Person
from ..youtube.models import PlaylistItem


class PlaylistItemPersonnalites(BaseModel):
    playlist_item: PlaylistItem
    personnalites: List[Union[Person, None]]
