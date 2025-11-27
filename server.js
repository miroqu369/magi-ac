import app from './src/index.js';

const PORT = process.env.PORT || 8888;

app.listen(PORT, () => {
  console.log(`[INFO] ✅ MAGI Analytics Center running on port ${PORT}`);
  console.log(`[INFO] 📊 BigQuery integration enabled`);
  console.log(`[INFO] 📄 Cohere document analysis enabled`);
  console.log(`[INFO] 💾 Cloud Storage integration enabled`);
});
