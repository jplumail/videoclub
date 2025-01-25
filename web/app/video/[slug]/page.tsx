import { Storage } from '@google-cloud/storage';


interface MoviesData {
    media_items_timestamps: MovieData[];
}

interface MovieData {
    media_item: any;
    start_time: Timecode;
    end_time: Timecode;
    confidence: number;
}

interface Timecode {
    seconds: number;
    nanos: number;
}

interface ConfigurationDetails {
    images: {
        base_url: string;
        secure_base_url: string;
        backdrop_sizes: string[];
        logo_sizes: string[];
        poster_sizes: string[];
        profile_sizes: string[];
        still_sizes: string[];
    };
    change_keys: string[];
}

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

async function getConfigurationDetails(): Promise<ConfigurationDetails> {
    return fetch('https://api.themoviedb.org/3/configuration', {
        method: 'GET',
        headers: {
            accept: 'application/json',
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NjRiZGFiMmZiODY0NGFjYzRiZTJjZmYyYmI1MjQxNCIsIm5iZiI6MTczNjQxNTQzNi4xMzMsInN1YiI6IjY3N2Y5OGNjMDQ0YjZjYTY3NjRlODgwYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.200sno32bOBgHhi_Jv1pCrDWJaal8tClKsHUFf2TZIQ'
        }
    })
        .then(res => res.json())
        .then(data => {
            return data;
        });
}

function getSecureBaseUrl(configurationDetails: ConfigurationDetails) {
    return configurationDetails.images.secure_base_url;
}

function getPosterSize(configurationDetails: ConfigurationDetails) {
    return configurationDetails.images.poster_sizes.filter(size => size === 'w185')[0];
}

function getPosterUrl(posterPath: string, configurationDetails: ConfigurationDetails) {
    const secureBaseUrl = getSecureBaseUrl(configurationDetails);
    const posterSize = getPosterSize(configurationDetails);
    return `${secureBaseUrl}${posterSize}${posterPath}`;
}

function getYoutubeUrl(videoId: string, timecode: number) {
    return `https://www.youtube.com/watch?v=${videoId}&t=${timecode}s`;
}

export default async function Page({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const slug = (await params).slug
    const videoId = getVideoId(slug)
    const storage = new Storage();
    const bucket = storage.bucket('videoclub-test');

    const [files] = await bucket.getFiles({
        prefix: `videos/${videoId}`,
    });

    const moviesFile = files.filter(file => file.name.endsWith('movies.json'))[0];
    const [content] = await moviesFile.download();
    const moviesData: MoviesData = JSON.parse(content.toString());
    moviesData.media_items_timestamps.sort((a, b) => a.start_time.seconds - b.start_time.seconds);
    const configurationDetails = await getConfigurationDetails();

    return <div>{moviesData.media_items_timestamps.map((item) => {
        const posterUrl = getPosterUrl(item.media_item.details.poster_path, configurationDetails);
        return <a href={getYoutubeUrl(videoId, item.start_time.seconds)} target='_blank'><img src={posterUrl} /></a>
    })}</div>
}
