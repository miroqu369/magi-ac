'use strict';
const { Storage } = require('@google-cloud/storage');

class StorageService {
  constructor() {
    this.client = new Storage();
    this.bucket = this.client.bucket('magi-ac-data');
  }

  async save(data, path) {
    const file = this.bucket.file(path);
    await file.save(JSON.stringify(data, null, 2), { contentType: 'application/json' });
    return `gs://magi-ac-data/${path}`;
  }

  async read(path) {
    const file = this.bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [content] = await file.download();
    return JSON.parse(content.toString());
  }

  async list(prefix) {
    const [files] = await this.bucket.getFiles({ prefix });
    return files.map(f => f.name);
  }
}

module.exports = StorageService;
