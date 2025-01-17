/* eslint-disable no-await-in-loop */
import Queue from 'bull';
import { ObjectId } from 'mongodb';
import thumbnail from 'image-thumbnail';
import fs from 'fs';
import dbClient from './utils/db';

const fileQueue = new Queue('generateImageThumbnail');
const userQueue = new Queue('sendEmail');

fileQueue.process(async (job) => {
  if (!job.data.fileId) throw new Error('Missing fileId');

  if (!job.data.userId) throw new Error('Missing userId');

  const { fileId, userId } = job.data;

  let file = null;
  try {
    const query = { _id: ObjectId(fileId), userId: ObjectId(userId) };
    file = await dbClient.filesCollection.findOne(query);
  } catch (error) {
    throw new Error('File not found');
  }

  if (!file) throw new Error('File not found');

  const thumbnailSizes = [500, 250, 100];
  for (const size of thumbnailSizes) {
    const options = { width: size };
    const thumbnailPath = `${file.localPath}_${size}`;
    try {
      const thumbnailBuffer = await thumbnail(file.localPath, options);
      await fs.promises.writeFile(thumbnailPath, thumbnailBuffer);
    } catch (error) {
      console.error(error.message);
    }
  }
});

userQueue.process(async (job) => {
  const { userId } = job.data;

  if (!userId) throw new Error('Missing userId');

  let user = null;
  try {
    const query = { _id: ObjectId(userId) };
    user = await dbClient.usersCollection.findOne(query);
  } catch (error) {
    throw new Error('User not found');
  }
  if (!user) throw new Error('User not found');
  console.log(`Welcome ${user.email}`);
});
