import app from './src/index.js';

const PORT = process.env.PORT || 8888;

app.listen(PORT, () => {
  console.log(`[INFO] ✅ MAGI Analytics Center running on port ${PORT}`);
});
