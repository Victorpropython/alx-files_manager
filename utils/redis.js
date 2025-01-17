const { createClient } = require('redis');
const { promisify } = require('util');

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (error) => {
      console.error(`${error}`);
    });
  }

  /**
   * Checks if the redis client is active
   * @returns Boolean
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Gets the value for a given key
   * @param {String} key
   * @returns
   */
  async get(key) {
    const getAsync = promisify(this.client.get).bind(this.client);
    const value = await getAsync(key);
    return value;
  }

  /**
   * Sets a key with its value in redis and adds expiration duration
   * @param {String} key
   * @param {any} value
   * @param {Number} duration
   */
  async set(key, value, duration) {
    const setAsync = promisify(this.client.set).bind(this.client);
    await setAsync(key, value, 'EX', duration);
  }

  /**
   * Removes the value of a key from Redis
   * @param {String} key
   */
  async del(key) {
    const delAsync = promisify(this.client.del).bind(this.client);
    await delAsync(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
