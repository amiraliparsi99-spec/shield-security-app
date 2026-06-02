// Ambient declarations for non-code imports (side-effect CSS imports such as
// `import "leaflet/dist/leaflet.css"`). Keeps the type-checker happy for assets
// that the bundler resolves at build time.
declare module "*.css";
