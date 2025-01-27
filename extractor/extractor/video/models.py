from pydantic import BaseModel
from typing import List, Union
from ..youtube.models import PlaylistItem
from ..annotate.models import Person


class PlaylistItemPersonnalites(BaseModel):
    playlist_item: PlaylistItem
    personnalites: List[Union[Person, None]]
