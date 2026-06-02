const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const METADATA_PATH = path.join(DATA_DIR, "metadata.json");
const PUBLIC_DIR = path.join(__dirname, "public");

function assetVersion() {
  const files = ["styles.css", "app.js", "index.html"];
  let latest = 0;
  for (const file of files) {
    const filePath = path.join(PUBLIC_DIR, file);
    if (fs.existsSync(filePath)) {
      latest = Math.max(latest, fs.statSync(filePath).mtimeMs);
    }
  }
  return String(Math.floor(latest));
}

function serveIndex(_req, res) {
  let html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  const v = assetVersion();
  html = html
    .replace('href="/styles.css"', `href="/styles.css?v=${v}"`)
    .replace('src="/app.js"', `src="/app.js?v=${v}"`);
  res.set("Cache-Control", "no-cache");
  res.type("html").send(html);
}

function ensureDirs() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(METADATA_PATH)) {
    fs.writeFileSync(METADATA_PATH, "[]", "utf8");
  }
}

function readMetadata() {
  try {
    return JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
  } catch {
    return [];
  }
}

function writeMetadata(entries) {
  fs.writeFileSync(METADATA_PATH, JSON.stringify(entries, null, 2), "utf8");
}

function sanitizeFilename(name) {
  const base = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "image";
}

function uniqueFilename(desired, ext) {
  let candidate = `${desired}${ext}`;
  let n = 1;
  while (fs.existsSync(path.join(UPLOADS_DIR, candidate))) {
    candidate = `${desired}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

ensureDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const safeExt = allowed.includes(ext) ? ext : ".png";
    const base = sanitizeFilename(req.body.name || "image");
    cb(null, uniqueFilename(base, safeExt));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype);
    cb(ok ? null : new Error("Only image files are allowed"), ok);
  },
});

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR, { index: false }));

app.get("/api/images", (_req, res) => {
  const entries = readMetadata().sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );
  res.json(entries);
});

app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { name, category, assetQuality } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!category?.trim()) {
      return res.status(400).json({ error: "Category is required" });
    }
    if (!["good", "bad"].includes(assetQuality)) {
      return res
        .status(400)
        .json({ error: "Asset quality must be good or bad" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const entry = {
      id: `${Date.now()}-${req.file.filename}`,
      name: name.trim(),
      category: category.trim(),
      assetQuality,
      filename: req.file.filename,
      url: `/file/${req.file.filename}`,
      uploadedAt: new Date().toISOString(),
    };

    const entries = readMetadata();
    entries.push(entry);
    writeMetadata(entries);

    res.status(201).json(entry);
  });
});

app.get("/file/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Not found");
  }
  res.sendFile(filePath);
});

app.get("/", serveIndex);

app.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/file")) {
    return res.status(404).send("Not found");
  }
  if (path.extname(req.path)) {
    return res.status(404).send("Not found");
  }
  serveIndex(req, res);
});

app.listen(PORT, () => {
  console.log(`fylstore listening on ${PORT}`);
  console.log(`data dir: ${DATA_DIR}`);
});
