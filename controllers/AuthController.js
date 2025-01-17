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

    try {
      // Extract and decode Base64 credentials
      const encodedCredentials = req.headers.authorization.split(' ')[1];
      const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
      const [email, password] = decodedCredentials.split(':');

      if (!email || !password) {
        throw new Error('Invalid credentials');
      }

      // Hash the provided password
      const hashedPassword = sha1(password);

      // Query the database for the user
      const user = await dbClient.usersCollection.findOne({ email, password: hashedPassword });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Generate a token and store it in Redis
      const token = uuidv4();
      const redisKey = `auth_${token}`;
      const userId = user._id.toString();

      await redisClient.set(redisKey, userId, 86400); // 24-hour expiry

      return res.status(200).json({ token });
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  static async getDisconect(req, res) {
    const token = req.headers['x-token'];
    console.log('Recieved token:', token);
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const redisKey = `auth_${token}`;
    console.log("Redis key:", redisKey);

    const result = await redisClient.del(redisKey);

    if (result === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ id: userId, email: user.email });
  }
}
