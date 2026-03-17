/**
 * Build for cPanel (no path prefix).
 * Upload the contents of _site/ to your cPanel "britline" folder so that
 * folder is the document root (e.g. subdomain or addon domain pointing to britline).
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
