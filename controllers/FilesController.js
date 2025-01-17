export default class FilesController {
  static async getUserByToken(req) {
    const token = req.headers['x-token'];
    if (!token) {
      return null;
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return null;
    }
    const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
    return user || null;
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;

    // Find the file in the database
    const file = await dbClient.filesCollection.findOne({ _id: ObjectId(id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Handle unpublished files
    if (!file.isPublic) {
      const user = await FilesController.getUserByToken(req);
      if (!user || file.userId.toString() !== user._id.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    // Validate the file type
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // Validate the file's existence on the filesystem
    try {
      await fs.promises.access(file.localPath, fs.constants.F_OK);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Determine the file's MIME type and serve it
    const mimeType = mine.lookup(file.name) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);

    // Handle image resizing
    if (file.type === 'image' && size) {
      const allowedSizes = [100, 250, 500];
      if (allowedSizes.includes(parseInt(size, 10))) {
        try {
          const resizedPath = `${file.localPath}_${size}`;
          const resizedContent = await fs.promises.readFile(resizedPath);
          return res.status(200).send(resizedContent);
        } catch {
          return res.status(404).json({ error: 'Not found' });
        }
      } else {
        return res.status(400).json({ error: 'Invalid size parameter' });
      }
    }

    // Serve the file content
    try {
      const fileContent = await fs.promises.readFile(file.localPath);
      return res.status(200).send(fileContent);
    } catch {
      return res.status(500).json({ error: 'Unable to read file' });
    }
  }
}
