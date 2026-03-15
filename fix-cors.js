const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Inițializare Google Cloud Storage cu același Service Account
const storage = new Storage({
  keyFilename: path.join(__dirname, 'serviceAccountKey.json'),
  projectId: 'wearwise-2cec5'
});

async function listBuckets() {
  console.log('⏳ Căutare bucket-uri...');
  try {
    const [buckets] = await storage.getBuckets();
    console.log('Buckets găsite:');
    buckets.forEach(bucket => {
      console.log(`- ${bucket.name}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('❌ Eroare la citirea bucket-urilor:', err.message);
    process.exit(1);
  }
}

listBuckets();
