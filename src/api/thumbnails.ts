import { getBearerToken, validateJWT } from '../auth';
import { respondWithJSON } from './json';
import { getVideo, updateVideo } from '../db/videos';
import type { ApiConfig } from '../config';
import type { BunRequest } from 'bun';
import { BadRequestError, NotFoundError, UserForbiddenError } from './errors';
import path from 'path';
import { randomBytes } from 'crypto';
type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

// const videoThumbnails: Map<string, Thumbnail> = new Map();

// export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
//   const { videoId } = req.params as { videoId?: string };
//   if (!videoId) {
//     throw new BadRequestError('Invalid video ID');
//   }

//   const video = getVideo(cfg.db, videoId);
//   if (!video) {
//     throw new NotFoundError("Couldn't find video");
//   }

//   const thumbnail = videoThumbnails.get(videoId);
//   if (!thumbnail) {
//     throw new NotFoundError('Thumbnail not found');
//   }

//   return new Response(thumbnail.data, {
//     headers: {
//       'Content-Type': thumbnail.mediaType,
//       'Cache-Control': 'no-store',
//     },
//   });
// }

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError('Invalid video ID');
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log('uploading thumbnail for video', videoId, 'by user', userID);

  // TODO: implement the upload here  --------------------------- START
  const formData = await req.formData();
  const file = formData.get('thumbnail');

  if (!(file instanceof File)) {
    throw new BadRequestError('Thumbnail file missing');
  }

  //Bit shifting is a way to multiply by powers of 2. 10 << 20 is the same as 10 * 1024 * 1024, which is 10MB.
  const MAX_UPLOAD_SIZE = 10 << 20;

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError('File size exceeded MAX UPLOAD SIZE');
  }

  const mediaType = file.type;

  if (mediaType !== 'image/jpeg' && mediaType !== 'image/png') {
    throw new BadRequestError('File not jpeg or png image file');
  }

  const imageDataBuffer = await file.arrayBuffer();
  const thumbnail: Thumbnail = {
    data: imageDataBuffer,
    mediaType: mediaType,
  };
  const video = getVideo(cfg.db, videoId);

  if (!video) {
    // MAYBE remove
    throw new BadRequestError('VideoId does not exist');
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError('unauthorized video access');
  }
  const generatedThumbnailString = randomBytes(32).toString('base64url');
  // const imageDataBufferString = Buffer.from(imageDataBuffer).toString('base64');
  const assetFilePath = path.join(
    cfg.assetsRoot,
    `${generatedThumbnailString}.${mediaType.split('/')[1]}`
  );

  console.log(` generatedThumbnailString \n: ${generatedThumbnailString}`);

  const assetURL = `http://localhost:${cfg.port}/` + assetFilePath;
  video.thumbnailURL = assetURL;
  await Bun.write(assetFilePath, imageDataBuffer);

  updateVideo(cfg.db, video);

  // Test your handler manually by using the Tubely UI to upload the boots-image-horizontal.png image. You should see the thumbnail update in the UI!
  return respondWithJSON(200, video);
}
