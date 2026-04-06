function groupBy(list, keyFn) {
  return list.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

module.exports = function () {
  let products = [];
  try {
    // eslint-disable-next-line global-require
    products = require("./products.json");
  } catch (e) {
    products = [];
  }

  const byCategory = groupBy(products, (p) => p.categorySlug || "uncategorized");

  // Stable order within each category for nicer UX
  Object.keys(byCategory).forEach((slug) => {
    byCategory[slug].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || (a.name || "").localeCompare(b.name || "", "bg"));
  });

  return byCategory;
};

