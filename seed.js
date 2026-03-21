const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase with the correct Storage Bucket from your Firebase config
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "wearwise-2cec5.firebasestorage.app"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const dataPath = path.join(__dirname, '../frontend/assets/wardrobe/all');

// Helper pentru a încărca imaginea din folderul de pe disk în Firebase Storage
async function uploadImage(localPath) {
    const fullPath = path.join(__dirname, '../frontend/assets', localPath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ Nu s-a găsit fișierul: ${fullPath}  ->  Sărim peste articol...`);
        return null;
    }

    const fileName = path.basename(localPath);
    const destination = `clothes_seed/${Date.now()}_${fileName}`;
    
    console.log(`  Cloud Upload: ${fileName}...`);
    
    await bucket.upload(fullPath, {
        destination: destination,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        }
    });

    // Construire URL Firebase public permanent 
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media`;
}

async function seed() {
  console.log('⏳ Citim datele și încărcăm imaginile în Firebase Storage (acest proces poate dura 1-2 minute)...');
  
  if (!fs.existsSync(dataPath)) {
      console.error('❌ Fișierul sursă nu a putut fi găsit la:', dataPath);
      process.exit(1);
  }
  
  const fileContent = fs.readFileSync(dataPath, 'utf8');
  const items = [];
  
  // Parcurgem datele pentru a extrage URL-urile modelelor
  const blockRegex = /\{([^}]*?cod_articol[^}]*?img_url[^}]*?)\}/g;
  let blockMatch;
  
  while ((blockMatch = blockRegex.exec(fileContent)) !== null) {
      const block = blockMatch[1];
      const modelMatch = block.match(/model:\s*"([^"]*)"/);
      const imgMatch = block.match(/img_url:\s*"([^"]*)"/);
      const priceMatch = block.match(/pret_ron:\s*([\d.]+)/);
      
      if (modelMatch && imgMatch) {
          items.push({
              name: modelMatch[1],
              local_img_path: imgMatch[1],
              price: priceMatch && !isNaN(parseFloat(priceMatch[1])) ? parseFloat(priceMatch[1]) : 50
          });
      }
      if (items.length >= 25) break; 
  }

  console.log(`🪄 Am selectat ${items.length} iteme valide din fișierul text.`);

  const batch = db.batch();
  let uploadedCount = 0;
  
  for(let i = 0; i < items.length; i++) {
     const extItem = items[i];
     
     // ==== AICI ÎNCĂRCĂM IMAGINEA PE FIREBASE STORAGE ====
     const publicUrl = await uploadImage(extItem.local_img_path);
     if (!publicUrl) continue; // Dacă lipsește imaginea din folderul "wardrobe", o ignorăm!
     
     const modes = ['sell', 'sell', 'both', 'trade', 'donate'];
     const mode = modes[Math.floor(Math.random() * modes.length)];
     const price = (mode === 'trade' || mode === 'donate') ? null : extItem.price;
     const distance = (Math.random() * 15 + 0.5).toFixed(1); 
     
     const sizes = ['XS', 'S', 'M', 'L', 'XL'];
     const conditions = ['new', 'good', 'fair'];
     
     const item = {
       userId: 'system_seed_user', // un ID generic să nu blocheze interfața
       name: extItem.name,
       description: 'Acest articol a fost încărcat direct prin seed script, cu imagine inclusă reală.',
       images: [publicUrl], // Aici setam LINK-UL PUBLIC, ex: https://firebasestorage...
       category: 'others',
       size: sizes[Math.floor(Math.random() * sizes.length)],
       condition: conditions[Math.floor(Math.random() * conditions.length)],
       mode: mode,
       price: price,
       distance: parseFloat(distance), 
       latitude: 44.4268 + (Math.random() * 0.1 - 0.05), // Randomizare aprox. zona București
       longitude: 26.1025 + (Math.random() * 0.1 - 0.05),
       status: 'active',
       createdAt: admin.firestore.FieldValue.serverTimestamp()
     };
     
     const docRef = db.collection('clothes').doc();
     batch.set(docRef, item);
     uploadedCount++;
  }
  
  if(uploadedCount > 0) {
      await batch.commit();
      console.log(`✅ Succes absolut! S-au încărcat în baza de date DB ${uploadedCount} haine, iar FIȘIERELE au fost urcate cu succes în Firebase Storage ☁️!`);
  } else {
      console.log('⚠️ Nu au putut fi încărcate haine. Asigură-te că imaginile JPG din d:\\Workshop\\WearWiseApp\\frontend\\assets\\wardrobe\\... există pe disk.');
  }

  process.exit(0);
}

seed().catch(err => {
    console.error('❌ Eroare fatală la seed:', err);
    process.exit(1);
});
