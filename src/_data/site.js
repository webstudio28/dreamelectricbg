const path = require("path");
const config = require(path.join(__dirname, "site.config.json"));

function loadJson(name) {
  try {
    return require(path.join(__dirname, name));
  } catch (e) {
    return null;
  }
}

const services = loadJson("services.json") || [];
const projects = loadJson("projects.json") || [];
const productCategories = loadJson("productCategories.json") || [];

function resolveChildrenFrom(type) {
  if (type === "services") {
    return services.map((s) => ({
      label: s.title,
      url: `/uslugi/${s.slug}/`,
    }));
  }
  if (type === "projects") {
    return projects.map((p) => ({
      label: p.title,
      url: `/proekti/${p.slug}/`,
    }));
  }
  if (type === "productCategories" || type === "productsNested") {
    return productCategories.map((c) => ({
      label: c.title,
      url: `/produkti/#${c.slug}`,
    }));
  }
  return [];
}

function resolveNavHeader(header) {
  if (!Array.isArray(header)) return [];
  return header.map((item) => {
    const { childrenFrom, ...rest } = item;
    const out = { ...rest };
    if (Array.isArray(item.children) && item.children.length) {
      out.children = item.children;
    } else if (childrenFrom) {
      out.children = resolveChildrenFrom(childrenFrom);
    } else {
      delete out.children;
    }
    return out;
  });
}

module.exports = {
  ...config,
  currentYear: new Date().getFullYear(),
  nav: {
    ...config.nav,
    header: resolveNavHeader(config.nav?.header || []),
  },
};
