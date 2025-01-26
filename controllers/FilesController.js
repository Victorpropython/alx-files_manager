import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import mine from 'mime-types';
import { promisify } from 'util';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

export default class FilesController {
  static async getUserByToken(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve user based on token
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return user;
  }

  static async postUpload(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve user based on token
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve request parameters
    const {
      name, type, parentId, isPublic, data,
    } = req.body;

    // Validate request paramenters
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    const acceptedTypes = ['folder', 'file', 'image'];

    if (!type || !acceptedTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (parentId) {
      const existingParentIdFile = await dbClient.filesCollection.findOne(
        { _id: ObjectId(parentId) },
      );
      if (!existingParentIdFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (existingParentIdFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Create a new new folder object
    const newFolder = {
      name,
      type,
      parentId: parentId || 0,
      isPublic: isPublic || false,
      userId: ObjectId(userId),
    };
    if (parentId) newFolder.parentId = ObjectId(parentId);

    if (type === 'folder') {
      const result = await dbClient.filesCollection.insertOne(newFolder);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId || 0,
      });
    }

    const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileDataBase64 = Buffer.from(data, 'base64');
    const fileName = uuidv4();
    const filePath = path.join(FOLDER_PATH, fileName);

    try {
      if (!fs.existsSync(FOLDER_PATH)) {
        // The recursive option ensures that the directory and
      //   necessary parent directories are created recursively
        await mkdirAsync(FOLDER_PATH, { recursive: true });
      }
      await writeFileAsync(filePath, fileDataBase64);
    } catch (error) {
      console.log(error.message);
    }

    const newFile = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
      localPath: filePath,
    };
    if (parentId) newFile.parentId = ObjectId(parentId);
    const result = await dbClient.filesCollection.insertOne(newFile);
    const fileId = result.insertedId;

    // Add a job to the fileQue if type === image
    if (type === 'image') {
      const fileQueue = new Queue('generateImageThumbnail');
      // Add a job to queue
      await fileQueue.add({ userId, fileId });
    }
    return res.status(201).json({
      id: fileId,
      userId,
      name,
      isPublic: isPublic || false,
      parentId: parentId || 0,
    });
  }

  static async getShow(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Retrieve user by token
    const user = await FilesController.getUserByToken(req, res);

    // Retrieve files attached to userId
    const files = await dbClient.filesCollection.findOne({
      userId: user._id,
      _id: ObjectId(id),
    });
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Format keys from _id to id
    const { _id, ...rest } = files;
    const editedFiles = { id: _id, ...rest };

    return res.status(200).json(editedFiles);
  }

  static async getIndex(req, res) {
    const user = await FilesController.getUserByToken(req, res);
    const { parentId, page = 0 } = req.query;
    const pageSize = 20;
    const searchParam = {
      userId: user._id,
      parentId: 0,
    };
    if (parentId) {
      searchParam.parentId = ObjectId(parentId);
    }
    const files = await dbClient.filesCollection.find(searchParam)
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();

    // Format keys from _id to id
    const editedFiles = files.map((obj) => {
      const { _id, ...rest } = obj;
      return { id: _id, ...rest };
    });
    return res.status(200).json(editedFiles);
  }

  static async publish(req, res, makePublic) {
    const user = await FilesController.getUserByToken(req, res);

    if (!('_id' in user && 'email' in user)) {
      return;
    }
    const { id } = req.params;
    const filter = { _id: ObjectId(id), userId: user._id };
    const file = await dbClient.filesCollection.findOne(filter);
    if (!file) {
      // eslint-disable-next-line consistent-return
      return res.status(404).json({ error: 'Not found' });
    }
    const update = { $set: { isPublic: makePublic } };
    await dbClient.filesCollection.updateOne(filter, update);
    const modifiedFile = await dbClient.filesCollection.findOne(filter);
    // Format keys from _id to id
    const { _id, ...rest } = modifiedFile;
    const editedModifiedFile = { id: _id, ...rest };
    delete editedModifiedFile.localPath;

    // eslint-disable-next-line consistent-return
    return res.status(200).json(editedModifiedFile);
  }

  static async putPublish(req, res) {
    FilesController.publish(req, res, true);
  }

  static async putUnpublish(req, res) {
    FilesController.publish(req, res, false);
  }

  static async getFile(req, res) {
    // Get request parameters
    const { id } = req.params;
    const { size } = req.query;

    // Check if there is a document in db linked to the id
    const file = await dbClient.filesCollection.findOne({ _id: ObjectId(id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check if file or folder is public
    if (!file.isPublic) {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Retrieve user based on token
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(404).json({ error: 'Not found' });
      }

      const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if user is owner of the file
      if (file.userId.toString() !== user._id.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    // File is either public or owned by user at this stage
    if (file.type === 'folder') {
      return res.status(404).json({ error: "A folder doesn't have content" });
    }

    // Check if file path exists
    try {
      await fs.promises.access(file.localPath, fs.constants.F_OK);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Get the mime type of the file
    const mimeType = mine.lookup(file.name);

    // Set the header with the correct mine type
    res.setHeader('Content-type', mimeType);
    if (file.type === 'image' && size) {
      if ([500, 250, 100].includes(parseInt(size, 10))) {
        let output = null;
        output = await fs.promises.readFile(`${file.localPath}_${parseInt(size, 10)}`);
        if (!output) {
          return res.status(404).json({ error: 'Not found' });
        }
        return res.status(200).send(output);
      }
      return res.status(404).json({ error: 'Not found' });
    }

    const output = await fs.promises.readFile(file.localPath);
    return res.status(200).send(output);
  }
}
