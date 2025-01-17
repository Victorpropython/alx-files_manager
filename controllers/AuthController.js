import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {
  static async getConnect(req, res) {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get authorization and decode into 'utf-8
    const encodedCredentials = req.headers.authorization.split(' ')[1];
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
    const [email, password] = decodedCredentials.split(':');

    // Hash the password using SHA1
    const hashedPassword = sha1(password);

    let user = null;
    try {
      user = await dbClient.usersCollection.findOne({ email, hashedPassword });
    } catch (error) {
      return res.json({ error: error.message });
    }

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Create userId token using uuidv4
    const token = uuidv4();
    const redisKey = `auth_${token}`;
    const userId = `${user._id}`;

    // Store the userId in redis
    await redisClient.set(redisKey, userId, 86400);

    return res.status(200).send({ token });
  }

  static async getDisconect(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);
    return res.status(204).send();
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
    return res.status(200).json({ id: userId, email: user.email });
  }
}
