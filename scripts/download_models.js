const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');
const LIB_DIR = path.join(__dirname, '..', 'public', 'js', 'lib');

[MODELS_DIR, LIB_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

const filesToDownload = [
  // face-api.min.js library
  {
    url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js',
    dest: path.join(LIB_DIR, 'face-api.min.js')
  },
  // Tiny Face Detector
  { url: `${BASE_URL}/tiny_face_detector_model-weights_manifest.json`, dest: path.join(MODELS_DIR, 'tiny_face_detector_model-weights_manifest.json') },
  { url: `${BASE_URL}/tiny_face_detector_model-shard1`, dest: path.join(MODELS_DIR, 'tiny_face_detector_model-shard1') },

  // SSD MobileNet v1
  { url: `${BASE_URL}/ssd_mobilenetv1_model-weights_manifest.json`, dest: path.join(MODELS_DIR, 'ssd_mobilenetv1_model-weights_manifest.json') },
  { url: `${BASE_URL}/ssd_mobilenetv1_model-shard1`, dest: path.join(MODELS_DIR, 'ssd_mobilenetv1_model-shard1') },
  { url: `${BASE_URL}/ssd_mobilenetv1_model-shard2`, dest: path.join(MODELS_DIR, 'ssd_mobilenetv1_model-shard2') },

  // Face Landmark 68
  { url: `${BASE_URL}/face_landmark_68_model-weights_manifest.json`, dest: path.join(MODELS_DIR, 'face_landmark_68_model-weights_manifest.json') },
  { url: `${BASE_URL}/face_landmark_68_model-shard1`, dest: path.join(MODELS_DIR, 'face_landmark_68_model-shard1') },

  // Face Recognition
  { url: `${BASE_URL}/face_recognition_model-weights_manifest.json`, dest: path.join(MODELS_DIR, 'face_recognition_model-weights_manifest.json') },
  { url: `${BASE_URL}/face_recognition_model-shard1`, dest: path.join(MODELS_DIR, 'face_recognition_model-shard1') },
  { url: `${BASE_URL}/face_recognition_model-shard2`, dest: path.join(MODELS_DIR, 'face_recognition_model-shard2') }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`[SKIP] Already exists: ${path.basename(dest)}`);
      return resolve();
    }

    console.log(`[DOWNLOADING] ${url} -> ${path.basename(dest)}`);
    const file = fs.createWriteStream(dest);

    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return reject(new Error(`Failed to download ${url}: Status ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`[DONE] ${path.basename(dest)}`);
          resolve();
        });
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Downloading face-api models and script file...');
  for (const item of filesToDownload) {
    try {
      await downloadFile(item.url, item.dest);
    } catch (err) {
      console.error(`Error downloading ${item.url}:`, err.message);
    }
  }
  console.log('All downloads completed!');
}

run();
