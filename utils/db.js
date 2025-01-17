import mongodb from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.DB_PORT || 27017;
    const db = process.env.DB_DATABASE || 'files_manager';
    const URL = `mongodb://${host}:${port}/${db}`;

    this.client = new mongodb.MongoClient(URL, {
      useUnifiedTopology: true,
    });

    this.isConnected = false;
    this.client.connect().then(() => {
      this.isConnected = true;
    });
    this.usersCollection = this.client.db().collection('users');
    this.filesCollection = this.client.db().collection('files');
  }

  /**
   * Checks if connection to MongoDB is a success
   * @returns Boolean
   */
  isAlive() {
    return this.isConnected;
  }

  /**
   * Method that returns the number of documents in users collection
   * @returns Array of Users
   */
  async nbUsers() {
    // Connect to database
    const result = await this.usersCollection.countDocuments();
    return result;
  }

  /**
   * Method that returns the number of documents in files collection
   * @returns Array of Files
   */
  async nbFiles() {
    // Connect to database
    const result = await this.filesCollection.countDocuments();
    return result;
  }
}

const dbClient = new DBClient();
export default dbClient;
