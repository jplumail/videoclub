
from extractor.models import TextSegment
from pydantic import BaseModel


class TextAnnotationSegment(BaseModel):
    segment: TextSegment
    text: str


class TextAnnotationSegmentGroup(BaseModel):
    segments: list[TextAnnotationSegment] = []

    def get_start_time(self):
        return min([x.segment.segment.start_time_offset for x in self.segments])

    def get_end_time(self):
        return max([x.segment.segment.end_time_offset for x in self.segments])

    def get_text(self):
        return [x.text for x in self.segments]

    def get_confidence(self):
        return sum([x.segment.confidence for x in self.segments]) / len(self.segments)


class TextAnnotationSegmentGroupOrganized(TextAnnotationSegmentGroup):
    heading_segments: list[TextAnnotationSegment]
    details_segments: list[TextAnnotationSegment]

    def model_post_init(self, __context):
        # Initialize segments by combining heading and details
        self.segments = self.heading_segments + self.details_segments

    def get_heading_text(self):
        return " ".join([x.text for x in self.heading_segments])

    def get_details_text(self):
        return " ".join([x.text for x in self.details_segments])
