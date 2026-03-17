module.exports = function (eleventyConfig) {
  // Passthrough copy: src/assets → _site/assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Favicon: src/favicon.png → output root (Eleventy paths are relative to project root)
  eleventyConfig.addPassthroughCopy({ "src/favicon.png": "favicon.png" });

  // For sitemap lastmod
  eleventyConfig.addGlobalData("buildDate", () => new Date().toISOString().slice(0, 10));

  // pathPrefix from env (for subfolder hosting)
  const pathPrefix = process.env.PATH_PREFIX || "/";

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
    },
    pathPrefix,
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
  };
};
