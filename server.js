const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const METADATA_PATH = path.join(DATA_DIR, "metadata.json");
const CATEGORIES_PATH = path.join(DATA_DIR, "categories.json");
const FOLDERS_PATH = path.join(DATA_DIR, "folders.json");
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
  if (!fs.existsSync(FOLDERS_PATH)) {
    fs.writeFileSync(FOLDERS_PATH, "[]", "utf8");
  }
  syncCategoriesFromMetadata();
}

function readFolders() {
  try {
    if (!fs.existsSync(FOLDERS_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(FOLDERS_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFolders(folders) {
  const sorted = [...folders].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  fs.writeFileSync(FOLDERS_PATH, JSON.stringify(sorted, null, 2), "utf8");
}

function findFolder(folderId) {
  return readFolders().find((f) => f.id === folderId) || null;
}

function readCategories() {
  try {
    if (!fs.existsSync(CATEGORIES_PATH)) {
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(CATEGORIES_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCategories(categories) {
  const sorted = [...categories].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(sorted, null, 2), "utf8");
}

function syncCategoriesFromMetadata() {
  const fromImages = readMetadata()
    .map((e) => e.category?.trim())
    .filter(Boolean);
  const existing = readCategories();
  const merged = [...existing];
  for (const cat of fromImages) {
    if (!merged.some((c) => c.toLowerCase() === cat.toLowerCase())) {
      merged.push(cat);
    }
  }
  if (merged.length > 0) {
    writeCategories(merged);
  } else if (!fs.existsSync(CATEGORIES_PATH)) {
    writeCategories([]);
  }
}

function addCategory(category) {
  const value = String(category).trim();
  if (!value) return readCategories();
  const categories = readCategories();
  if (categories.some((c) => c.toLowerCase() === value.toLowerCase())) {
    return categories;
  }
  categories.push(value);
  writeCategories(categories);
  return categories;
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

const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

function safeExtension(originalName) {
  const ext = path.extname(originalName).toLowerCase() || ".png";
  return ALLOWED_EXT.includes(ext) ? ext : ".png";
}

function buildFilename(displayName, originalName) {
  const base = sanitizeFilename(displayName);
  return uniqueFilename(base, safeExtension(originalName));
}

ensureDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = safeExtension(file.originalname);
    cb(null, `upload-${Date.now()}${ext}`);
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

app.get("/api/categories", (_req, res) => {
  res.json(readCategories());
});

app.get("/api/folders", (_req, res) => {
  res.json(readFolders());
});

app.post("/api/folders", (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) {
    return res.status(400).json({ error: "Folder name is required" });
  }
  const folders = readFolders();
  if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: "A folder with this name already exists" });
  }
  const folder = {
    id: `folder-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
  };
  folders.push(folder);
  writeFolders(folders);
  res.status(201).json(folder);
});

app.patch("/api/images/:id", (req, res) => {
  const imageId = req.params.id;
  const { folderId } = req.body;

  const entries = readMetadata();
  const index = entries.findIndex((e) => e.id === imageId);
  if (index === -1) {
    return res.status(404).json({ error: "Image not found" });
  }

  let resolvedFolderId = null;
  if (folderId !== null && folderId !== undefined && folderId !== "") {
    if (!findFolder(folderId)) {
      return res.status(400).json({ error: "Folder not found" });
    }
    resolvedFolderId = folderId;
  }

  entries[index] = { ...entries[index], folderId: resolvedFolderId };
  writeMetadata(entries);
  res.json(entries[index]);
});

app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { name, category, assetQuality, folderId } = req.body;
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

    let resolvedFolderId = null;
    if (folderId && folderId !== "null" && folderId !== "") {
      if (!findFolder(folderId)) {
        return res.status(400).json({ error: "Folder not found" });
      }
      resolvedFolderId = folderId;
    }

    const finalFilename = buildFilename(name, req.file.originalname);
    const tempPath = path.join(UPLOADS_DIR, req.file.filename);
    const finalPath = path.join(UPLOADS_DIR, finalFilename);
    if (req.file.filename !== finalFilename) {
      fs.renameSync(tempPath, finalPath);
    }

    const entry = {
      id: `${Date.now()}-${finalFilename}`,
      name: name.trim(),
      category: category.trim(),
      assetQuality,
      folderId: resolvedFolderId,
      filename: finalFilename,
      url: `/file/${finalFilename}`,
      uploadedAt: new Date().toISOString(),
    };

    const entries = readMetadata();
    entries.push(entry);
    writeMetadata(entries);
    const categories = addCategory(category);

    res.status(201).json({ ...entry, categories });
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
