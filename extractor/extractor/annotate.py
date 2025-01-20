from google.cloud import videointelligence


def annotate_video(bucket_name, video_blob_name):
    output_uri = f"gs://{bucket_name}/{video_blob_name}.json"
    client = videointelligence.VideoIntelligenceServiceClient()
    request = videointelligence.AnnotateVideoRequest(
        input_uri=f"gs://{bucket_name}/{video_blob_name}",
        features=[videointelligence.Feature.TEXT_DETECTION],
        output_uri=output_uri
    )
    operation = client.annotate_video(request=request)
    operation.result()
    return output_uri


if __name__ == "__main__":
    import sys

    annotate_video(sys.argv[1], sys.argv[2])