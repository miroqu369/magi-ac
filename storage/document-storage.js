import { Storage } from '@google-cloud/storage';
import { BigQuery } from '@google-cloud/bigquery';

const storage = new Storage();
const bigquery = new BigQuery();

const BUCKET_NAME = 'magi-documents';
const DATASET_ID = 'magi_ac';
const TABLE_ID = 'document_analyses';

/**
 * BigQueryテーブル初期化（存在しない場合作成）
 */
async function ensureTable() {
  const schema = [
    { name: 'analysis_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
    { name: 'analysis_type', type: 'STRING', mode: 'REQUIRED' },  // sentiment, financials, summary
    { name: 'result_json', type: 'STRING', mode: 'NULLABLE' },
    { name: 'storage_path', type: 'STRING', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  ];

  try {
    const [exists] = await bigquery.dataset(DATASET_ID).table(TABLE_ID).exists();
    if (!exists) {
      await bigquery.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
      console.log(`[DocumentStorage] Table ${TABLE_ID} created`);
    }
  } catch (error) {
    console.error('[DocumentStorage] Table check error:', error.message);
  }
}

// 起動時にテーブル確認
ensureTable();

/**
 * 文書解析結果を保存
 */
export async function saveDocumentAnalysis(symbol, analysisType, result, originalText = null) {
  const analysisId = `${symbol}_${analysisType}_${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  try {
    // 1. 元テキストがあればCloud Storageに保存
    let storagePath = null;
    if (originalText && originalText.length > 500) {
      const fileName = `${symbol}/${analysisType}/${analysisId}.txt`;
      const file = storage.bucket(BUCKET_NAME).file(fileName);
      await file.save(originalText, { contentType: 'text/plain' });
      storagePath = `gs://${BUCKET_NAME}/${fileName}`;
      console.log(`[DocumentStorage] Text saved: ${storagePath}`);
    }

    // 2. BigQueryにメタデータ保存
    const row = {
      analysis_id: analysisId,
      symbol: symbol.toUpperCase(),
      analysis_type: analysisType,
      result_json: JSON.stringify(result),
      storage_path: storagePath,
      created_at: bigquery.timestamp(new Date()),
    };

    await bigquery.dataset(DATASET_ID).table(TABLE_ID).insert([row]);
    console.log(`[DocumentStorage] ✅ Saved: ${analysisId}`);
    
    return { analysisId, storagePath };
  } catch (error) {
    console.error('[DocumentStorage] Save error:', error.message);
    return null;
  }
}

/**
 * 銘柄の文書解析履歴を取得
 */
export async function getDocumentHistory(symbol, analysisType = null, limit = 20) {
  try {
    let query = `
      SELECT analysis_id, symbol, analysis_type, result_json, storage_path, created_at
      FROM \`${DATASET_ID}.${TABLE_ID}\`
      WHERE symbol = @symbol
    `;
    
    if (analysisType) {
      query += ` AND analysis_type = @analysisType`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT @limit`;
    
    const options = {
      query,
      params: { symbol: symbol.toUpperCase(), analysisType, limit },
    };
    
    const [rows] = await bigquery.query(options);
    return rows.map(row => ({
      ...row,
      result: JSON.parse(row.result_json || '{}'),
    }));
  } catch (error) {
    console.error('[DocumentStorage] Query error:', error.message);
    return [];
  }
}

export const documentStorage = {
  saveDocumentAnalysis,
  getDocumentHistory,
};
