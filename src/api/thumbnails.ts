import { getBearerToken, validateJWT } from '../auth";
import { respondWithJSON } from "./json";
import { getVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}


/*
[ ] 8. Update the video metadata so that it uses the new thumbnail URL, then update the record in the database by using the updateVideo function available in db/videos.
This will all work because the api/thumbnails/:videoID endpoint serves thumbnails from that global map.

[ ] 9. Respond with updated JSON of the video's metadata. Use the provided respondWithJSON function and pass it the updated video to marshal.
[ ] 10. Test your handler manually by using the Tubely UI to upload the boots-image-horizontal.png image. You should see the thumbnail update in the UI!


*/
export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here  --------------------------- START
  const formData = await req.formData();
  const file = formData.get('thumbnail');

  if (! (file instanceof File) ) {
    throw new BadRequestError('Thumbnail file missing');
  }

  //Bit shifting is a way to multiply by powers of 2. 10 << 20 is the same as 10 * 1024 * 1024, which is 10MB.
  const MAX_UPLOAD_SIZE = 10 << 20;

  if ( file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError('File size exceeded MAX UPLOAD SIZE')
  }

  const mediaType = file.type;
  const imageDataBuffer = await file.arrayBuffer();
  const thumbnail: Thumbnail = {
    data: imageDataBuffer,
    mediaType: mediaType,
  }
  const video = getVideo(cfg.db, videoId)


  if (!video) { // MAYBE remove
    throw new BadRequestError('VideoId does not exist')
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError('unauthorized video access')
  }

  videoThumbnails.set(videoId, thumbnail)

  const thumbnailUrl = `http://localhost:${cfg.port}/api/thumbnails/${videoId}`

  // [ ] 8 Update the video metadata so that it uses the new thumbnail URL,
  // -- then update the record in the database by using the updateVideo function available in db/videos.


  return respondWithJSON(200, null);
}
