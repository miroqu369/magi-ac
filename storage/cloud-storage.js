import { Storage } from "@google-cloud/storage";
import path from "path";

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "screen-share-459802",
});

const bucketName = "magi-documents";
const bucket = storage.bucket(bucketName);

/**
 * ファイルを Cloud Storage にアップロード
 */
export async function uploadFile(fileBuffer, symbol, filename, category = "uploads") {
  try {
    const date = new Date().toISOString().split("T")[0];
    const fileExt = path.extname(filename);
    const baseName = path.basename(filename, fileExt);
    const timestamp = Date.now();
    
    const storagePath = `${category}/${date}/${symbol}_${baseName}_${timestamp}${fileExt}`;
    
    const file = bucket.file(storagePath);
    
    await file.save(fileBuffer, {
      metadata: {
        contentType: getContentType(fileExt),
        metadata: {
          symbol: symbol,
          uploadedAt: new Date().toISOString(),
          originalFilename: filename,
        },
      },
    });
    
    console.log(`✓ Cloud Storage にアップロード: gs://magi-documents/${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error("❌ Cloud Storage アップロードエラー:", error);
    throw error;
  }
}

/**
 * JSON 分析結果を保存
 */
export async function saveAnalysisResult(analysisData, symbol, analysisType = "earnings") {
  try {
    const date = new Date().toISOString().split("T")[0];
    const timestamp = Date.now();
    
    const storagePath = `analysis-results/${date}/${symbol}_${analysisType}_${timestamp}.json`;
    
    const file = bucket.file(storagePath);
    
    await file.save(JSON.stringify(analysisData, null, 2), {
      metadata: {
        contentType: "application/json",
        metadata: {
          symbol: symbol,
          analysisType: analysisType,
          savedAt: new Date().toISOString(),
        },
      },
    });
    
    console.log(`✓ Cloud Storage に分析結果を保存: gs://magi-documents/${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error("❌ Cloud Storage 保存エラー:", error);
    throw error;
  }
}

/**
 * センチメント分析結果を保存
 */
export async function saveSentimentReport(sentimentData, symbol) {
  try {
    const date = new Date().toISOString().split("T")[0];
    const timestamp = Date.now();
    
    const storagePath = `sentiment-reports/${date}/${symbol}_sentiment_${timestamp}.json`;
    
    const file = bucket.file(storagePath);
    
    await file.save(JSON.stringify(sentimentData, null, 2), {
      metadata: {
        contentType: "application/json",
        metadata: {
          symbol: symbol,
          reportType: "sentiment",
          savedAt: new Date().toISOString(),
        },
      },
    });
    
    console.log(`✓ Cloud Storage にセンチメントレポートを保存: gs://magi-documents/${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error("❌ Cloud Storage 保存エラー:", error);
    throw error;
  }
}

/**
 * 公開 URL を生成 (署名付き)
 */
export async function getSignedUrl(filePath, expiresIn = 7 * 24 * 60 * 60 * 1000) {
  try {
    const file = bucket.file(filePath);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresIn,
    });
    
    console.log(`✓ 署名付きURL生成: ${filePath}`);
    return url;
  } catch (error) {
    console.error("❌ 署名付きURL生成エラー:", error);
    throw error;
  }
}

/**
 * 日付ディレクトリ内のファイル一覧
 */
export async function listFilesByDate(category, date) {
  try {
    const prefix = `${category}/${date}/`;
    const [files] = await bucket.getFiles({ prefix });
    
    const fileList = files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      created: file.metadata.timeCreated,
    }));
    
    console.log(`✓ ファイル一覧取得: ${prefix}`);
    return fileList;
  } catch (error) {
    console.error("❌ ファイル一覧取得エラー:", error);
    throw error;
  }
}

/**
 * ファイルタイプに応じた Content-Type を取得
 */
function getContentType(fileExt) {
  const types = {
    ".pdf": "application/pdf",
    ".json": "application/json",
    ".txt": "text/plain",
    ".csv": "text/csv",
  };
  return types[fileExt] || "application/octet-stream";
}

export default {
  uploadFile,
  saveAnalysisResult,
  saveSentimentReport,
  getSignedUrl,
  listFilesByDate,
};
