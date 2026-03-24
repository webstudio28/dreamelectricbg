/**
 * Build for cPanel (no path prefix — same as CI).
 * Upload the contents of _site/ to your cPanel "dreamelectricbg" folder so that
 * folder is the document root (e.g. addon domain dreamelectricbg.com pointing there).
 */

const { execSync } = require("child_process");
const path = require("path");

console.log("Building for cPanel (no path prefix)...\n");

try {
  execSync("npm run build", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
  console.log("\nBuild complete.");
  console.log("Upload the contents of _site/ to your cPanel britline folder (document root).\n");
} catch (err) {
  process.exit(err.status || 1);
}
