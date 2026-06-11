// Newer Perry (0.5.x) requires the engine's web native-library target to
// declare `crate`+`lib` or `prebuilt`. The published engine ships the older
// schema (crate/output, no lib), so `perry compile --target web` fails with
// "crate and lib must be declared together". Both local builds and CI now run
// this Perry, so we patch the (gitignored) node_modules copy in place — the file
// perry actually reads — rather than changing the committed engine config.
// Called by build-web.sh before the web compile.
//
// Idempotent: injects an absolute `prebuilt` path to the already-built
// wasm-pack pkg dir. Run before `perry compile --target web`.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const PKG_JSON = path.join(ROOT, "node_modules/@bloomengine/engine/package.json");
const PREBUILT = path.join(ROOT, "node_modules/@bloomengine/engine/native/web/pkg");

const p = JSON.parse(fs.readFileSync(PKG_JSON, "utf8"));
const web = p.perry && p.perry.nativeLibrary && p.perry.nativeLibrary.targets && p.perry.nativeLibrary.targets.web;
if (!web) {
  console.error("no perry.nativeLibrary.targets.web in engine package.json — schema changed?");
  process.exit(1);
}
if (web.prebuilt === PREBUILT) {
  console.log("engine web target already patched");
} else {
  web.prebuilt = PREBUILT;
  fs.writeFileSync(PKG_JSON, JSON.stringify(p, null, 2));
  console.log("patched engine web target prebuilt ->", PREBUILT);
}
