import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {

  static async getConnect(req, res) {
    try {
      if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Decode credentials
      const encodedCredentials = req.headers.authorization.split(' ')[1];
      let decodedCredentials;
      try {
        decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
      } catch {
        return res.status(400).json({ error: 'Invalid Base64 content' });
      }

      const [email, password] = decodedCredentials.split(':');
      if (!email || !password) {
        return res.status(400).json({ error: 'Invalid credentials format' });
      }

      // Hash the password using SHA1
      const hashedPassword = sha1(password);

      // Find user
      const user = await dbClient.usersCollection.findOne({ email, password: hashedPassword });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Create token
      const token = uuidv4();
      const redisKey = `auth_${token}`;
      await redisClient.set(redisKey, user._id.toString(), 86400);

      return res.status(200).json({ token });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDisconect(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(404).json({ error: 'Token not found' });
      }

      await redisClient.del(`auth_${token}`);
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }


}
