const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Resolve uploads folder relative to backend root, so it works the same
// in local dev, SSH (npm run dev) and cPanel/PM2 environments.
const rootDir = path.resolve(__dirname, '..', '..');
const uploadRoot = path.join(rootDir, 'uploads');
const servicesDir = path.join(uploadRoot, 'services');
const bannersDir = path.join(uploadRoot, 'banners');
const categoriesDir = path.join(uploadRoot, 'categories');
const kycDir = path.join(uploadRoot, 'kyc');
const profilesDir = path.join(uploadRoot, 'profiles');

[servicesDir, bannersDir, categoriesDir, kycDir, profilesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const createStorage = (dir) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const base = path.basename(file.originalname, ext).replace(/\s+/g, '-').toLowerCase();
      cb(null, `${base}-${Date.now()}${ext}`);
    }
  });

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Only image uploads are allowed'));
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage: createStorage(servicesDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadBanner = multer({
  storage: createStorage(bannersDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadCategory = multer({
  storage: createStorage(categoriesDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadKyc = multer({
  storage: createStorage(kycDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadProfile = multer({
  storage: createStorage(profilesDir),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = {
  upload,
  uploadBanner,
  uploadCategory,
  uploadRoot,
  servicesDir,
  bannersDir,
  categoriesDir,
  uploadKyc,
  kycDir,
  uploadProfile,
  profilesDir
};

