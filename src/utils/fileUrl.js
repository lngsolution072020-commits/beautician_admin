function buildFileUrl(req, folder, filename) {
  if (!filename) return null;
  return `${req.protocol}://${req.get('host')}/2026/beautician/backend/uploads/${folder}/${filename}`;
}

module.exports = {
  buildFileUrl
};

