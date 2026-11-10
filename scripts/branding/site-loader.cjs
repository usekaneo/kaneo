const { brandResources } = require("../../branding/index.cjs");

module.exports = function (source) {
  // Catalog values are copy; keys stay upstream-compatible.
  if (this.resourcePath.endsWith(".json"))
    return JSON.stringify(brandResources(JSON.parse(source)));
  const done = this.async();
  import("./source.mjs")
    .then(({ transformCopy }) => {
      done(null, transformCopy(source, this.resourcePath));
    })
    .catch(done);
};
