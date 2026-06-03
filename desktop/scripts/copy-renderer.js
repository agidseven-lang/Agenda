// Sem bundler — o renderer já é um único HTML. Este script existe só
// para o npm script "build:renderer" não falhar; o electron-builder
// empacota src/renderer/** via electron-builder.yml > files.
console.log("renderer ok (no bundle needed)");
