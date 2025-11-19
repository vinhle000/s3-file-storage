import { respondWithJSON } from './json';
import { getBearerToken, validateJWT } from '../auth';
import { getVideo } from '../db/videos';

import { type ApiConfig } from '../config';
import type { BunRequest } from 'bun';
import { BadRequestError, NotFoundError, UserForbiddenError } from './errors';
import { randomBytes } from 'crypto';
import path from 'path';
import { assert } from 'console';

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  // NOTE: Need to specfically be UUID type
  // [ ] Extract the videoId from the URL path parameters and parse it as a UUID
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError('Invalid videoId');
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret); // will throw error if not valid

  // [ ] 4. get metadata
  const video = await getVideo(cfg.db, videoId);

  if (!video) {
    throw new BadRequestError('VideoId does not exist');
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError('Unathorized');
  }

  const formData = await req.formData();
  const file = formData.get('video');

  if (!(file instanceof File)) {
    throw new BadRequestError('Video file missing');
  }

  const MAX_UPLOAD_SIZE = 1 << 30; // 1GB
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError('Video file exceeds max upload size');
  }

  const mediaType = file.type;
  if (mediaType !== 'video/mp4') {
    throw new BadRequestError('File not a video mp4');
  }

  // NOTE: Remember to remove the temp file when the process finishes.
  const videoDataBuffer = await file.arrayBuffer();

  const randomByteString = randomBytes(32).toString('base64');
  const assertFilePath = path.join(
    cfg.assetsRoot,
    `${randomByteString}.${mediaType.split('/')[1]}`
  );
  const assertURL = `http://localhost:${cfg.port}/` + assertFilePath;

  await Bun.write(assertFilePath, videoDataBuffer);

  // [ ]  put object to s3

  return respondWithJSON(200, null);
}
