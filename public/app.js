const form = document.getElementById("upload-form");
const gallery = document.getElementById("gallery");
const galleryEmpty = document.getElementById("gallery-empty");
const galleryCount = document.getElementById("gallery-count");
const formMessage = document.getElementById("form-message");

function showMessage(text, type) {
  formMessage.hidden = false;
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`;
}

function clearMessage() {
  formMessage.hidden = true;
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function publicUrl(path) {
  const base = window.location.origin;
  return `${base}${path}`;
}

function renderCard(entry) {
  const card = document.createElement("article");
  card.className = "card";

  const img = document.createElement("img");
  img.className = "card-thumb";
  img.src = entry.url;
  img.alt = entry.name;
  img.loading = "lazy";

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = entry.name;

  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = entry.category;

  const badge = document.createElement("span");
  badge.className = `badge ${entry.assetQuality}`;
  badge.textContent =
    entry.assetQuality === "good" ? "Good asset" : "Bad asset";

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = entry.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = publicUrl(entry.url);

  body.append(title, meta, badge, link);
  card.append(img, body);
  return card;
}

async function loadGallery() {
  const res = await fetch("/api/images");
  const entries = await res.json();

  gallery.innerHTML = "";
  galleryCount.textContent =
    entries.length === 0 ? "" : `${entries.length} image${entries.length === 1 ? "" : "s"}`;
  galleryEmpty.hidden = entries.length > 0;

  for (const entry of entries) {
    gallery.appendChild(renderCard(entry));
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  const data = new FormData(form);

  try {
    const res = await fetch("/api/upload", { method: "POST", body: data });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      showMessage(body.error || "Upload failed", "error");
      return;
    }

    showMessage(`Uploaded. Public URL: ${publicUrl(body.url)}`, "success");
    form.reset();
    await loadGallery();
  } catch {
    showMessage("Network error. Try again.", "error");
  } finally {
    btn.disabled = false;
  }
});

loadGallery();
