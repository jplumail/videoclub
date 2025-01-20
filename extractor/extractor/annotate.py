from google.cloud import videointelligence


def annotate_video(bucket_name: str, video_blob_name: str, annotation_blob_name: str):
    assert annotation_blob_name.endswith(".json")
    output_uri = f"gs://{bucket_name}/{annotation_blob_name}"
    client = videointelligence.VideoIntelligenceServiceClient()
    request = videointelligence.AnnotateVideoRequest(
        input_uri=f"gs://{bucket_name}/{video_blob_name}",
        features=[videointelligence.Feature.TEXT_DETECTION],
        output_uri=output_uri
    )
    operation = client.annotate_video(request=request)
    operation.result()
    return annotation_blob_name


if __name__ == "__main__":
    import sys

    annotate_video(sys.argv[1], sys.argv[2], sys.argv[3])