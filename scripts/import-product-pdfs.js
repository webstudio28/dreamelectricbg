/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PRODUCTS_PATH = path.join(ROOT, "src", "_data", "products.json");
const SEED_PATH = path.join(ROOT, "src", "_data", "products.seed.json");
const DOCS_DIR = path.join(ROOT, "src", "assets", "docs", "products");

const TARGET_CATEGORIES = new Set([
  "monofazni-hibridni",
  "trifazni-hibridni",
  "trifazni-mrezhovi-invertori",
  "baterii",
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

function slugFromProductUrl(url) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  const idx = parts.lastIndexOf("product");
  const raw = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1];
  return decodeURIComponentSafe(raw || "").trim();
}

function sanitizeFileName(name) {
  return String(name || "file")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/%[0-9a-f]{2}/gi, "-")
    .replace(/[^a-z0-9\-_.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function decodeHtml(str) {
  return String(str || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeUrl(rawUrl, pageUrl) {
  try {
    return new URL(rawUrl, pageUrl).toString();
  } catch (e) {
    return null;
  }
}

function extractPdfCandidates(html, pageUrl) {
  const byHref = new Map();

  function add(hrefRaw, textRaw) {
    const href = normalizeUrl(decodeHtml(hrefRaw), pageUrl);
    if (!href || !/\.pdf(\?|$)/i.test(href)) return;
    const text = decodeHtml(textRaw || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const prev = byHref.get(href);
    if (!prev || (text.length > prev.length)) {
      byHref.set(href, { href, text });
    }
  }

  const anchorRe =
    /<a[^>]*href\s*=\s*["']([^"']+?\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html))) {
    add(m[1], m[2]);
  }

  const anyHrefRe = /href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
  while ((m = anyHrefRe.exec(html))) {
    add(m[1], "");
  }

  return Array.from(byHref.values());
}

function classifyDoc(candidate) {
  const probe = `${candidate.href} ${candidate.text}`.toLowerCase();
  const hrefLower = candidate.href.toLowerCase();

  // Technical (BG + EN) — check before generic "ръководство"
  if (
    /спецификаци|спецификация/.test(probe) ||
    /(datasheet|data[\s-]?sheet|technical[\s_-]?(sheet|data|spec)?|product[\s_-]?spec)/i.test(
      probe
    ) ||
    /(характеристик|техническ|техн\.|технич)/i.test(probe) ||
    /\b(spec|specs)\b/i.test(probe)
  ) {
    return { type: "technical", label: "Технически характеристики (PDF)" };
  }

  // Install / user manual (BG + EN)
  if (
    /употреба|user[\s_-]?manual|owner'?s?[\s_-]?manual/.test(probe) ||
    /(монтаж|installation|\binstall\b|montage|монтажн)/i.test(probe) ||
    /(manual|ръководство|инструкци)/i.test(probe)
  ) {
    const label =
      /употреба|user[\s_-]?manual|owner/i.test(probe)
        ? "Ръководство за употреба"
        : "Ръководство за монтаж";
    return { type: "install", label };
  }

  // Filename / URL hints when anchor text is missing or generic
  if (/(datasheet|ds[_-]|spec[_-]?sheet|technical)/i.test(hrefLower)) {
    return { type: "technical", label: "Технически характеристики (PDF)" };
  }
  if (/(manual|install|guide|user|ups|монтаж)/i.test(hrefLower)) {
    return {
      type: "install",
      label: /user|ups|употреба/i.test(hrefLower)
        ? "Ръководство за употреба"
        : "Ръководство за монтаж",
    };
  }

  return null;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; DreamElectricBot/1.0)",
      accept: "text/html,*/*",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return await res.text();
}

async function downloadPdf(url, destPath) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; DreamElectricBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(ab));
}

async function main() {
  ensureDir(DOCS_DIR);

  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf8"));
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));

  const sourceBySlug = new Map();
  for (const cat of seed.categories || []) {
    if (!TARGET_CATEGORIES.has(cat.categorySlug)) continue;
    for (const item of cat.items || []) {
      if (!item.url) continue;
      sourceBySlug.set(slugFromProductUrl(item.url), item.url);
    }
  }

  let updated = 0;
  let downloaded = 0;
  for (const p of products) {
    if (!TARGET_CATEGORIES.has(p.categorySlug)) continue;
    const sourceUrl = sourceBySlug.get(p.slug);
    if (!sourceUrl) continue;

    process.stdout.write(`Processing ${p.slug} ... `);
    try {
      const html = await fetchText(sourceUrl);
      const candidates = extractPdfCandidates(html, sourceUrl)
        .map((c) => ({ ...c, meta: classifyDoc(c) }))
        .filter((c) => c.meta);

      const byType = new Map();
      for (const c of candidates) {
        if (!byType.has(c.meta.type)) byType.set(c.meta.type, c);
      }

      const docs = [];
      for (const type of ["technical", "install"]) {
        const c = byType.get(type);
        if (!c) continue;
        const ext = ".pdf";
        const baseName = sanitizeFileName(`${p.slug}-${type}`) || `${p.slug}-${type}`;
        const relPath = `docs/products/${baseName}${ext}`;
        const absPath = path.join(ROOT, "src", "assets", relPath);
        if (!fs.existsSync(absPath)) {
          await downloadPdf(c.href, absPath);
          downloaded += 1;
        }
        docs.push({
          type,
          label: c.meta.label,
          file: relPath.replace(/\\/g, "/"),
          sourceUrl: c.href,
        });
      }

      if (docs.length) {
        p.documents = docs;
        updated += 1;
        console.log(`ok (${docs.length} docs)`);
      } else {
        delete p.documents;
        console.log("no docs");
      }
    } catch (e) {
      console.log(`failed (${e.message})`);
    }
  }

  fs.writeFileSync(PRODUCTS_PATH, `${JSON.stringify(products, null, 2)}\n`, "utf8");
  console.log(`\nUpdated products: ${updated}`);
  console.log(`Downloaded PDFs: ${downloaded}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

