let allEntries = [];
let allCategories = [];
let activeFilter = "all";
let activeCategory = "";
let searchQuery = "";
let previewEntry = null;

const form = document.getElementById("upload-form");
const gallery = document.getElementById("gallery");
const galleryEmpty = document.getElementById("gallery-empty");
const galleryCount = document.getElementById("gallery-count");
const searchInput = document.getElementById("search");
const categoryFilter = document.getElementById("category-filter");
const uploadCategory = document.getElementById("upload-category");
const categoryNewField = document.getElementById("category-new-field");
const categoryNewInput = document.getElementById("category-new-input");
const uploadDialog = document.getElementById("upload-dialog");
const previewDialog = document.getElementById("preview-dialog");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const dropPreview = document.getElementById("drop-preview");
const dropPlaceholder = document.getElementById("drop-placeholder");
const previewImg = document.getElementById("preview-img");
const toastEl = document.getElementById("toast");

function publicUrl(path) {
  return `${window.location.origin}${path}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

let toastTimer;
function toast(message, type = "") {
  clearTimeout(toastTimer);
  toastEl.hidden = false;
  toastEl.textContent = message;
  toastEl.className = `toast show${type ? ` ${type}` : ""}`;
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => {
      toastEl.hidden = true;
    }, 250);
  }, 2800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Link copied to clipboard", "success");
    return true;
  } catch {
    toast("Could not copy — try manually", "error");
    return false;
  }
}

function openUpload() {
  uploadDialog.showModal();
}

function closeUpload() {
  uploadDialog.close();
  resetDropZone();
  resetCategoryNewField();
  form.reset();
  fillSelect(uploadCategory, allCategories, {
    placeholder: "Select category",
    includeNew: true,
  });
}

function resetDropZone() {
  fileInput.value = "";
  dropZone.classList.remove("has-file", "dragover");
  dropPreview.hidden = true;
  dropPlaceholder.hidden = false;
  previewImg.src = "";
}

function setFile(file) {
  if (!file || !/^image\//.test(file.type)) {
    toast("Please choose an image file", "error");
    return;
  }
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  dropZone.classList.add("has-file");
  dropPreview.hidden = false;
  dropPlaceholder.hidden = true;

  if (!form.name.value) {
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-");
    form.name.value = base.toLowerCase();
  }
}

function getFiltered() {
  const q = searchQuery.trim().toLowerCase();
  return allEntries.filter((e) => {
    if (activeFilter !== "all" && e.assetQuality !== activeFilter) return false;
    if (activeCategory && e.category !== activeCategory) return false;
    if (q) {
      const hay = `${e.name} ${e.category} ${e.filename}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function fillSelect(select, cats, { placeholder, includeNew } = {}) {
  const current = select.value;
  select.innerHTML = "";
  if (placeholder) {
    const ph = document.createElement("option");
    ph.value = "";
    ph.disabled = true;
    ph.selected = !current;
    ph.textContent = placeholder;
    select.appendChild(ph);
  }
  for (const cat of cats) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }
  if (includeNew) {
    const neu = document.createElement("option");
    neu.value = "__new__";
    neu.textContent = "+ New category";
    select.appendChild(neu);
  }
  if (current && [...select.options].some((o) => o.value === current)) {
    select.value = current;
  }
}

function updateCategoryOptions() {
  const filterValue = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="">All categories</option>';
  for (const cat of allCategories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  }
  if (allCategories.includes(filterValue)) {
    categoryFilter.value = filterValue;
  }

  fillSelect(uploadCategory, allCategories, {
    placeholder: "Select category",
    includeNew: true,
  });
}

function resetCategoryNewField() {
  categoryNewField.hidden = true;
  categoryNewInput.value = "";
  categoryNewInput.required = false;
}

function getUploadCategoryValue() {
  if (uploadCategory.value === "__new__") {
    return categoryNewInput.value.trim();
  }
  return uploadCategory.value;
}

function renderCard(entry) {
  const card = document.createElement("article");
  card.className = "card";

  const media = document.createElement("div");
  media.className = "card-media";

  const img = document.createElement("img");
  img.className = "card-thumb";
  img.src = entry.url;
  img.alt = entry.name;
  img.loading = "lazy";

  const overlay = document.createElement("div");
  overlay.className = "card-overlay";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "overlay-btn";
  copyBtn.textContent = "Copy URL";
  copyBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    copyText(publicUrl(entry.url));
  });

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "overlay-btn";
  openBtn.textContent = "Open";
  openBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    window.open(entry.url, "_blank", "noopener");
  });

  overlay.append(copyBtn, openBtn);
  media.append(img, overlay);

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = entry.name;

  const row = document.createElement("div");
  row.className = "card-row";

  const category = document.createElement("p");
  category.className = "card-category";
  category.textContent = entry.category;

  const badge = document.createElement("span");
  badge.className = `badge ${entry.assetQuality}`;
  badge.textContent = entry.assetQuality === "good" ? "Pass" : "Fail";

  row.append(category, badge);

  const date = document.createElement("p");
  date.className = "card-date";
  date.textContent = formatDate(entry.uploadedAt);

  body.append(title, row, date);
  card.append(media, body);

  card.addEventListener("click", () => openPreview(entry));
  return card;
}

function openPreview(entry) {
  previewEntry = entry;
  document.getElementById("preview-full").src = entry.url;
  document.getElementById("preview-title").textContent = entry.name;
  document.getElementById("preview-details").textContent = `${entry.category} · ${
    entry.assetQuality === "good" ? "Expected to pass QC" : "Expected to fail QC"
  } · ${formatDate(entry.uploadedAt)}`;
  document.getElementById("preview-open").href = entry.url;
  previewDialog.showModal();
}

function renderGallery() {
  const filtered = getFiltered();
  gallery.innerHTML = "";

  const total = allEntries.length;
  const shown = filtered.length;

  if (total === 0) {
    galleryCount.textContent = "";
    galleryEmpty.hidden = false;
    return;
  }

  galleryEmpty.hidden = true;

  if (shown === total) {
    galleryCount.textContent = `${total} file${total === 1 ? "" : "s"}`;
  } else {
    galleryCount.textContent = `${shown} of ${total} files`;
  }

  if (shown === 0) {
    gallery.innerHTML =
      '<p class="empty-filter">No files match your filters.</p>';
    return;
  }

  for (const entry of filtered) {
    gallery.appendChild(renderCard(entry));
  }
}

async function loadCategories() {
  const res = await fetch("/api/categories");
  allCategories = await res.json();
}

async function loadGallery() {
  await Promise.all([
    fetch("/api/images").then((r) => r.json()).then((data) => {
      allEntries = data;
    }),
    loadCategories(),
  ]);
  updateCategoryOptions();
  renderGallery();
}

document.getElementById("open-upload").addEventListener("click", openUpload);
document.getElementById("empty-upload").addEventListener("click", openUpload);
document.getElementById("close-upload").addEventListener("click", closeUpload);
document.getElementById("cancel-upload").addEventListener("click", closeUpload);
document.getElementById("change-file").addEventListener("click", () => fileInput.click());

uploadDialog.addEventListener("click", (e) => {
  if (e.target === uploadDialog) closeUpload();
});

previewDialog.addEventListener("click", (e) => {
  if (e.target === previewDialog) previewDialog.close();
});
document.getElementById("close-preview").addEventListener("click", () => previewDialog.close());
document.getElementById("preview-copy").addEventListener("click", () => {
  if (previewEntry) copyText(publicUrl(previewEntry.url));
});

dropZone.addEventListener("click", (e) => {
  if (e.target.closest("#change-file")) return;
  if (!dropZone.classList.contains("has-file")) fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    renderGallery();
  });
});

categoryFilter.addEventListener("change", () => {
  activeCategory = categoryFilter.value;
  renderGallery();
});

uploadCategory.addEventListener("change", () => {
  if (uploadCategory.value === "__new__") {
    categoryNewField.hidden = false;
    categoryNewInput.required = true;
    categoryNewInput.focus();
    return;
  }
  resetCategoryNewField();
});

categoryNewInput.addEventListener("input", () => {
  if (categoryNewInput.value.trim()) {
    uploadCategory.removeAttribute("required");
  } else {
    uploadCategory.setAttribute("required", "required");
  }
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  renderGallery();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!fileInput.files[0]) {
    toast("Choose an image to upload", "error");
    return;
  }

  const btn = document.getElementById("submit-upload");
  btn.disabled = true;

  const category = getUploadCategoryValue();
  if (!category) {
    toast("Choose or enter a category", "error");
    return;
  }

  const data = new FormData();
  data.append("name", form.name.value.trim());
  data.append("category", category);
  data.append("assetQuality", form.assetQuality.value);
  data.append("file", fileInput.files[0]);

  try {
    const res = await fetch("/api/upload", { method: "POST", body: data });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast(body.error || "Upload failed", "error");
      return;
    }

    if (body.categories) {
      allCategories = body.categories;
    }
    toast("Upload complete", "success");
    closeUpload();
    await loadGallery();
  } catch {
    toast("Network error — try again", "error");
  } finally {
    btn.disabled = false;
  }
});

loadGallery();
