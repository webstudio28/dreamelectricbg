/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SEED_PATH = path.join(ROOT, "src", "_data", "products.seed.json");
const OUT_PATH = path.join(ROOT, "src", "_data", "products.json");
const IMG_DIR = path.join(ROOT, "src", "assets", "images", "products");

const HAIKSOLAR = "https://www.haiksolar.com";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

function sanitizeFileBase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/%[0-9a-f]{2}/gi, "-")
    .replace(/[^a-z0-9\-_.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function decodeHtmlEntities(str) {
  return String(str || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(html) {
  const s = String(html || "");
  const withNewlines = s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<\/\s*h\d\s*>/gi, "\n");
  const stripped = withNewlines.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(stripped)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractListItems(html) {
  const s = String(html || "");
  const matches = [...s.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  return matches
    .map((m) => htmlToText(m[1]))
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((t) => !/^всички цени са с включен ддс/i.test(t))
    .filter((t) => !/^[\p{Extended_Pictographic}]/u.test(t));
}

function pickOverview({ shortDescriptionHtml, descriptionHtml }) {
  const candidates = [];
  const shortText = htmlToText(shortDescriptionHtml);
  if (shortText) candidates.push(...shortText.split("\n").map((l) => l.trim()).filter(Boolean));

  const descText = htmlToText(descriptionHtml);
  if (descText) candidates.push(...descText.split("\n").map((l) => l.trim()).filter(Boolean));

  const cleaned = candidates
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((t) => !/^всички цени са с включен ддс/i.test(t))
    .filter((t) => !/^[\p{Extended_Pictographic}]/u.test(t))
    .filter((t) => !/^(основни характеристики|технически параметри|сертификати)\b/i.test(t))
    .filter((t) => t.length >= 20);

  return cleaned[0] || "";
}

function parseSlugFromProductUrl(url) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  const idx = parts.lastIndexOf("product");
  const rawSlug = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1];
  return rawSlug || "";
}

async function fetchWithRetry(url, { tries = 4, timeoutMs = 25000 } = {}) {
  let lastErr = null;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; DreamElectricBot/1.0; +https://dreamelectricbg.com)",
          accept: "*/*",
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return res;
    } catch (e) {
      lastErr = e;
      clearTimeout(t);
      const backoff = 600 * attempt + Math.floor(Math.random() * 300);
      await sleep(backoff);
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

async function fetchJson(url, opts) {
  const res = await fetchWithRetry(url, opts);
  return await res.json();
}

async function downloadImage(srcUrl, destPath) {
  const res = await fetchWithRetry(srcUrl, { tries: 3, timeoutMs: 30000 });
  const ab = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(ab));
}

function normalizeSpecs(attributes) {
  if (!Array.isArray(attributes)) return [];
  const rows = [];
  for (const attr of attributes) {
    const label = htmlToText(attr?.name).trim();
    const terms = Array.isArray(attr?.terms) ? attr.terms.map((t) => htmlToText(t?.name).trim()).filter(Boolean) : [];
    const value = terms.join(", ");
    if (!label || !value) continue;
    rows.push({ label, value });
  }
  // De-dupe identical rows
  const seen = new Set();
  return rows.filter((r) => {
    const k = `${r.label}::${r.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function parseEurFromMinorUnits(value, minorUnit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = Number(minorUnit);
  const div = Number.isFinite(unit) ? Math.pow(10, unit) : 100;
  return n / div;
}

function roundToNearest(value, step) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value / step) * step;
}

/** Strip supplier branding from image alt text (not shown as links, but avoid third-party names in a11y). */
function cleanImageAlt(alt, productName) {
  let t = htmlToText(alt).replace(/\s+/g, " ").trim();
  if (!t) return productName;
  t = t.replace(/\s*\|\s*hay\s+group\s*$/i, "").trim();
  t = t.replace(/\bhay\s+group\b/gi, "").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*[|–—]\s*$/g, "").trim();
  return t || productName;
}

async function resolveWpIdBySlug(rawSlug) {
  const slugParam = encodeURIComponent(rawSlug);
  const url = `${HAIKSOLAR}/wp-json/wp/v2/product?slug=${slugParam}`;
  const arr = await fetchJson(url, { tries: 4, timeoutMs: 25000 });
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[0]?.id || null;
}

async function fetchWcProductById(id) {
  const url = `${HAIKSOLAR}/wp-json/wc/store/v1/products/${id}`;
  return await fetchJson(url, { tries: 4, timeoutMs: 25000 });
}

function buildDescriptionSections({ descriptionHtml }) {
  const bullets = extractListItems(descriptionHtml).slice(0, 10);
  const textLines = htmlToText(descriptionHtml)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((t) => !/^всички цени са с включен ддс/i.test(t))
    .filter((t) => !/^[\p{Extended_Pictographic}]/u.test(t))
    .filter((t) => !/^(основни характеристики|технически параметри|сертификати)\b/i.test(t));

  // Keep a small number of paragraphs to fit your site tone
  const paragraphs = textLines.slice(0, 4);

  const sections = [];
  if (paragraphs.length || bullets.length) {
    sections.push({
      title: "",
      paragraphs,
      bullets: bullets.slice(0, 8),
    });
  }
  return sections;
}

async function main() {
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Seed not found at ${SEED_PATH}`);
    process.exit(1);
  }

  ensureDir(IMG_DIR);

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const categories = Array.isArray(seed?.categories) ? seed.categories : [];

  const out = [];
  let total = 0;
  categories.forEach((c) => (total += (c.items || []).length));

  console.log(`Importing ${total} products from HaikSolar...`);

  let globalIndex = 0;
  for (const cat of categories) {
    const categorySlug = cat.categorySlug;
    const items = Array.isArray(cat.items) ? cat.items : [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      globalIndex += 1;
      const sourceUrl = item.url;
      const rawSlug = parseSlugFromProductUrl(sourceUrl);
      const decodedSlug = safeDecodeURIComponent(rawSlug);

      process.stdout.write(`[${globalIndex}/${total}] ${decodedSlug} ... `);

      try {
        const wpId = item.wpId || (await resolveWpIdBySlug(rawSlug));
        if (!wpId) throw new Error(`Could not resolve WP id for slug: ${rawSlug}`);

        const wc = await fetchWcProductById(wpId);

        const regularEur = parseEurFromMinorUnits(wc?.prices?.regular_price, wc?.prices?.currency_minor_unit);
        const displayEur = regularEur ? roundToNearest(regularEur, 5) : null;

        const nameRaw = htmlToText(wc?.name).replace(/\s+/g, " ").trim();
        const urlSlug = safeDecodeURIComponent(wc?.slug || rawSlug).trim() || sanitizeFileBase(nameRaw) || `product-${wpId}`;

        const overviewRaw = pickOverview({
          shortDescriptionHtml: wc?.short_description,
          descriptionHtml: wc?.description,
        });

        const highlightsRaw = extractListItems(wc?.description).slice(0, 8);
        const specs = normalizeSpecs(wc?.attributes);

        const img = Array.isArray(wc?.images) && wc.images.length ? wc.images[0] : null;
        let localImage = null;
        if (img?.src) {
          const imgUrl = img.src;
          const ext = path.extname(new URL(imgUrl).pathname) || ".jpg";
          const fileBase = sanitizeFileBase(`${wpId}-${urlSlug}`) || String(wpId);
          const fileName = `${fileBase}${ext}`;
          const dest = path.join(IMG_DIR, fileName);
          if (!fs.existsSync(dest)) {
            await downloadImage(imgUrl, dest);
          }
          localImage = {
            local: `products/${fileName}`,
            alt: cleanImageAlt(img.alt, nameRaw),
          };
        }

        const overrides = item.override && typeof item.override === "object" ? item.override : {};
        const name = (overrides.name || nameRaw).trim();
        const overview = (overrides.overview || overviewRaw).trim();
        const highlights = Array.isArray(overrides.highlights) ? overrides.highlights : highlightsRaw;
        const descriptionSections = Array.isArray(overrides.descriptionSections)
          ? overrides.descriptionSections
          : buildDescriptionSections({ descriptionHtml: wc?.description });

        const displayEurFinal =
          typeof overrides.displayEur === "number" ? overrides.displayEur : displayEur;

        out.push({
          id: wpId,
          categorySlug,
          sortIndex: i + 1,
          slug: urlSlug,
          name,
          overview,
          highlights,
          specs,
          descriptionSections,
          price: {
            currency: wc?.prices?.currency_code || "EUR",
            regularEur,
            displayEur: displayEurFinal,
          },
          image: localImage,
          syncedAt: new Date().toISOString(),
        });

        console.log("ok");
        await sleep(250);
      } catch (e) {
        console.log("failed");
        console.error(`  Error: ${e.message}`);
        // Keep going so one bad item doesn’t block the entire import
      }
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${out.length} products to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

