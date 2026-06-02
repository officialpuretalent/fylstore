let allEntries = [];
let allCategories = [];
let allFolders = [];
let activeFilter = "all";
let activeCategory = "";
let searchQuery = "";
let currentFolderId = null;
let previewEntry = null;
let draggingImageId = null;

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
const breadcrumb = document.getElementById("breadcrumb");
const foldersSection = document.getElementById("folders-section");
const foldersRow = document.getElementById("folders-row");
const rootDrop = document.getElementById("root-drop");
const filesLabel = document.getElementById("files-label");
const folderDialog = document.getElementById("folder-dialog");
const folderForm = document.getElementById("folder-form");
const folderNameInput = document.getElementById("folder-name");

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

function folderIdOf(entry) {
  return entry.folderId || null;
}

function countInFolder(folderId) {
  return allEntries.filter((e) => folderIdOf(e) === folderId).length;
}

function getFiltered() {
  const q = searchQuery.trim().toLowerCase();
  const searching = q.length > 0;
  return allEntries.filter((e) => {
    if (!searching) {
      const viewFolder = currentFolderId || null;
      if (folderIdOf(e) !== viewFolder) return false;
    }
    if (activeFilter !== "all" && e.assetQuality !== activeFilter) return false;
    if (activeCategory && e.category !== activeCategory) return false;
    if (q) {
      const folder = allFolders.find((f) => f.id === folderIdOf(e));
      const folderName = folder ? folder.name : "";
      const hay = `${e.name} ${e.category} ${e.filename} ${folderName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

async function moveImage(imageId, folderId) {
  const res = await fetch(`/api/images/${encodeURIComponent(imageId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(body.error || "Could not move file", "error");
    return false;
  }
  const idx = allEntries.findIndex((e) => e.id === imageId);
  if (idx !== -1) allEntries[idx] = body;
  return true;
}

function setCurrentFolder(folderId) {
  currentFolderId = folderId;
  renderBreadcrumb();
  renderGallery();
}

function renderBreadcrumb() {
  breadcrumb.innerHTML = "";

  const rootBtn = document.createElement("button");
  rootBtn.type = "button";
  rootBtn.className = `breadcrumb-btn${currentFolderId ? "" : " current"}`;
  rootBtn.textContent = "All files";
  rootBtn.dataset.dropFolder = "root";
  rootBtn.addEventListener("click", () => {
    if (currentFolderId) setCurrentFolder(null);
  });
  breadcrumb.appendChild(rootBtn);

  if (!currentFolderId) return;

  const sep = document.createElement("span");
  sep.className = "breadcrumb-sep";
  sep.textContent = "/";
  breadcrumb.appendChild(sep);

  const folder = allFolders.find((f) => f.id === currentFolderId);
  const current = document.createElement("span");
  current.className = "breadcrumb-btn current";
  current.textContent = folder?.name || "Folder";
  breadcrumb.appendChild(current);
}

function folderIconSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "40");
  svg.setAttribute("height", "40");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  svg.classList.add("folder-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"
  );
  svg.appendChild(path);
  return svg;
}

function dropFolderIdFromEl(el) {
  const value = el.dataset.dropFolder;
  return value === "root" ? null : value;
}

function clearDropTargets() {
  document.querySelectorAll(".drop-target").forEach((el) => {
    el.classList.remove("drop-target");
  });
}

function initDragDrop() {
  const main = document.querySelector(".main-inner");

  main.addEventListener("dragover", (e) => {
    if (!draggingImageId) return;
    const target = e.target.closest("[data-drop-folder]");
    if (!target) return;
    e.preventDefault();
    clearDropTargets();
    target.classList.add("drop-target");
  });

  main.addEventListener("dragleave", (e) => {
    const target = e.target.closest("[data-drop-folder]");
    if (target && !target.contains(e.relatedTarget)) {
      target.classList.remove("drop-target");
    }
  });

  main.addEventListener("drop", async (e) => {
    const target = e.target.closest("[data-drop-folder]");
    if (!target) return;
    e.preventDefault();
    clearDropTargets();
    const imageId = e.dataTransfer.getData("text/plain") || draggingImageId;
    const folderId = dropFolderIdFromEl(target);
    if (!imageId) return;
    const entry = allEntries.find((i) => i.id === imageId);
    if (!entry || folderIdOf(entry) === folderId) return;
    const ok = await moveImage(imageId, folderId);
    if (ok) {
      toast(folderId ? "Moved to folder" : "Moved to All files", "success");
      renderGallery();
    }
    draggingImageId = null;
    rootDrop.hidden = true;
  });
}

function renderFolders() {
  foldersRow.innerHTML = "";
  const showFolders = !currentFolderId && !searchQuery.trim();
  foldersSection.hidden = !showFolders || allFolders.length === 0;

  if (!showFolders) return;

  for (const folder of allFolders) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "folder-card";
    card.appendChild(folderIconSvg());

    const name = document.createElement("p");
    name.className = "folder-name";
    name.textContent = folder.name;

    const count = document.createElement("p");
    count.className = "folder-count";
    const n = countInFolder(folder.id);
    count.textContent = `${n} file${n === 1 ? "" : "s"}`;

    card.dataset.dropFolder = folder.id;
    card.append(name, count);
    card.addEventListener("click", () => setCurrentFolder(folder.id));
    foldersRow.appendChild(card);
  }
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
  card.draggable = true;

  card.addEventListener("dragstart", (e) => {
    draggingImageId = entry.id;
    card.classList.add("dragging");
    e.dataTransfer.setData("text/plain", entry.id);
    e.dataTransfer.effectAllowed = "move";
    rootDrop.hidden = !folderIdOf(entry);
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    draggingImageId = null;
    rootDrop.hidden = true;
    document.querySelectorAll(".drop-target").forEach((el) => {
      el.classList.remove("drop-target");
    });
  });

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

  body.append(title);

  if (searchQuery.trim() && folderIdOf(entry)) {
    const folder = allFolders.find((f) => f.id === folderIdOf(entry));
    if (folder) {
      const tag = document.createElement("p");
      tag.className = "card-folder-tag";
      tag.textContent = folder.name;
      body.append(tag);
    }
  }

  body.append(row, date);
  card.append(media, body);

  card.addEventListener("click", (ev) => {
    if (card.classList.contains("dragging")) return;
    openPreview(entry);
  });
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
  renderBreadcrumb();
  renderFolders();

  const filtered = getFiltered();
  const imagesOnly = filtered;
  gallery.innerHTML = "";

  const inView = allEntries.filter((e) => {
    if (searchQuery.trim()) return true;
    return folderIdOf(e) === (currentFolderId || null);
  });
  const total = inView.length;
  const shown = imagesOnly.length;

  const hasFolders = !currentFolderId && !searchQuery.trim() && allFolders.length > 0;
  filesLabel.hidden = !hasFolders && shown === 0;

  if (allEntries.length === 0 && allFolders.length === 0) {
    galleryCount.textContent = "";
    galleryEmpty.hidden = false;
    return;
  }

  galleryEmpty.hidden = true;

  if (searchQuery.trim()) {
    galleryCount.textContent = `${shown} result${shown === 1 ? "" : "s"}`;
  } else if (shown === total) {
    galleryCount.textContent = `${total} file${total === 1 ? "" : "s"}`;
  } else {
    galleryCount.textContent = `${shown} of ${total} files`;
  }

  if (shown === 0) {
    const msg =
      total === 0 && currentFolderId
        ? "This folder is empty. Drag files here or upload new ones."
        : "No files match your filters.";
    gallery.innerHTML = `<p class="empty-filter">${msg}</p>`;
    return;
  }

  for (const entry of imagesOnly) {
    gallery.appendChild(renderCard(entry));
  }
}

async function loadCategories() {
  const res = await fetch("/api/categories");
  allCategories = await res.json();
}

async function loadFolders() {
  const res = await fetch("/api/folders");
  allFolders = await res.json();
}

async function loadGallery() {
  await Promise.all([
    fetch("/api/images").then((r) => r.json()).then((data) => {
      allEntries = data;
    }),
    loadCategories(),
    loadFolders(),
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
  if (currentFolderId) {
    data.append("folderId", currentFolderId);
  }

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

document.getElementById("open-folder-dialog").addEventListener("click", () => {
  folderNameInput.value = "";
  folderDialog.showModal();
});

document.getElementById("close-folder").addEventListener("click", () => folderDialog.close());
document.getElementById("cancel-folder").addEventListener("click", () => folderDialog.close());
folderDialog.addEventListener("click", (e) => {
  if (e.target === folderDialog) folderDialog.close();
});

folderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = folderNameInput.value.trim();
  if (!name) return;

  try {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(body.error || "Could not create folder", "error");
      return;
    }
    allFolders.push(body);
    allFolders.sort((a, b) => a.name.localeCompare(b.name));
    folderDialog.close();
    toast("Folder created", "success");
    renderGallery();
  } catch {
    toast("Network error — try again", "error");
  }
});

rootDrop.dataset.dropFolder = "root";
initDragDrop();

loadGallery();
