/* eslint-disable no-undef */
/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-expect-assertions */
import chai from 'chai';
import sinon from 'sinon';
import redis from 'redis';
import { promisify } from 'util';
import redisClient from '../utils/redis';

const { expect } = chai;

describe('redisClient', () => {
  let createClientStub;
  let onStub;
  let getAsyncStub;
  let setAsyncStub;
  let delAsyncStub;
  let redisClient;

  before(() => {
    createClientStub = sinon.stub(redis, 'createClient');
    onStub = sinon.stub();
    createClientStub.returns({
      on: onStub,
    });

    getAsyncStub = sinon.stub();
    setAsyncStub = sinon.stub();
    delAsyncStub = sinon.stub();

    // Replace the async methods with stubs
    sinon.replace(redisClient, 'get', getAsyncStub);
    sinon.replace(redisClient, 'set', setAsyncStub);
    sinon.replace(redisClient, 'del', delAsyncStub);
  });

  after(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should create a Redis client', () => {
      expect(createClientStub.calledOnce).to.be.true;
      expect(onStub.calledWith('error')).to.be.true;
    });
  });

  describe('isAlive', () => {
    it('should return true if the Redis client is connected', () => {
      redisClient.connected = true;
      const result = redisClient.isAlive();
      expect(result).to.be.true;
    });

    it('should return false if the Redis client is not connected', () => {
      redisClient.client.connected = false;
      const result = redisClient.isAlive();
      expect(result).to.be.false;
    });
  });

  describe('get', () => {
    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should retrieve the value for a given key from Redis', async () => {
      const key = 'testKey';
      const value = 'testValue';
      getAsyncStub.resolves(value);

      const result = await redisClient.get(key);

      expect(result).to.equal(value);
      expect(getAsyncStub.calledOnceWith(key)).to.be.true;
    });
  });

  describe('set', () => {
    it('should set a key-value pair in Redis with an expiration duration', async () => {
      const key = 'testKey';
      const value = 'testValue';
      const duration = 60;

      await redisClient.set(key, value, duration);

      expect(setAsyncStub.calledOnceWith(key, value, 'EX', duration)).to.be.true;
    });
  });

  describe('del', () => {
    it('should remove the value of a key from Redis', async () => {
      const key = 'testKey';

      await redisClient.del(key);

      expect(delAsyncStub.calledOnceWith(key)).to.be.true;
    });
  });
});