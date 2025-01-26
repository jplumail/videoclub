import { BucketManager, ConfigurationManager, MoviesData } from '@/lib/data';


function getVideoId(slug: string): string {
    const videoIdArray: string[] = [];
    slug.split('_').map((item, key) => {
        if (key > 0) {
            videoIdArray.push(item)
        }
    });
    const videoId = videoIdArray.join('_');
    return videoId;
}

function getYoutubeUrl(videoId: string, timecode: number | null) {
    if (timecode === null) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return `https://www.youtube.com/watch?v=${videoId}&t=${timecode}s`;
}

function getMinutes(seconds: number) {
    return Math.floor(seconds / 60).toString().padStart(2, '0');
}

function getSeconds(seconds: number) {
    return (seconds % 60).toString().padStart(2, '0');
}

function getUniqueMoviesData(moviesData: MoviesData) {
    const moviesSet = new Set();
    return moviesData.media_items_timestamps.filter((item) => {
        if (moviesSet.has(item.media_item.details.id)) {
            return false;
        }
        moviesSet.add(item.media_item.details.id);
        return true;
    });
}

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const slug = (await params).slug
    const videoId = getVideoId(slug)

    const moviesData = await BucketManager.getMovies(videoId);
    const uniqueMoviesData = getUniqueMoviesData(moviesData);

    moviesData.media_items_timestamps.sort((a, b) => a.start_time.seconds - b.start_time.seconds);
    return <div>{uniqueMoviesData.map(async (item) => {
        const posterUrl = await ConfigurationManager.getPosterUrl(item.media_item.details.poster_path);
        const sameMovies = moviesData.media_items_timestamps.filter((item2) => item2.media_item.details.id === item.media_item.details.id);
        return <div >
            <img src={posterUrl} />
            {sameMovies.map((item2) =>
                <a href={getYoutubeUrl(videoId, item2.start_time.seconds)} target='_blank'>
                    <p>{getMinutes(item2.start_time.seconds)}:{getSeconds(item2.start_time.seconds)}</p>
                </a>)}
        </div>
    })}</div>
}
