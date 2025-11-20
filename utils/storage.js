import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'magi-ac-data';
const BUCKET_PATH = 'raw/financials';

export async function saveToStorage(data) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${BUCKET_PATH}/${timestamp}-${data.symbol}.json`;
    const file = bucket.file(filename);

    await file.save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
      metadata: {
        symbol: data.symbol,
        timestamp: data.timestamp
      }
    });

    const uri = `gs://${BUCKET_NAME}/${filename}`;
    console.log(`[STORAGE] Saved: ${uri}`);
    return uri;

  } catch (error) {
    console.error('[STORAGE] Save failed:', error.message);
    
    // Fallback: Log to local file system
    console.log('[STORAGE] Using local fallback');
    const localPath = `/tmp/magi-ac-${Date.now()}.json`;
    await import('fs/promises').then(fs => 
      fs.writeFile(localPath, JSON.stringify(data, null, 2))
    );
    
    return `file://${localPath}`;
  }
}

export async function listFiles(prefix = BUCKET_PATH, maxResults = 100) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const [files] = await bucket.getFiles({
      prefix,
      maxResults
    });

    return files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      created: file.metadata.timeCreated,
      updated: file.metadata.updated
    }));

  } catch (error) {
    console.error('[STORAGE] List failed:', error.message);
    return [];
  }
}

export async function readFile(filename) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(filename);
    const [contents] = await file.download();
    return JSON.parse(contents.toString());

  } catch (error) {
    console.error('[STORAGE] Read failed:', error.message);
    throw error;
  }
}

export async function deleteFile(filename) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    await bucket.file(filename).delete();
    console.log(`[STORAGE] Deleted: ${filename}`);
    return true;

  } catch (error) {
    console.error('[STORAGE] Delete failed:', error.message);
    return false;
  }
}
