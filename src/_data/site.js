const path = require("path");
const config = require(path.join(__dirname, "site.config.json"));

module.exports = {
  ...config,
  currentYear: new Date().getFullYear(),
};
