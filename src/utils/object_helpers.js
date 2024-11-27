const selectKeys = (obj, ...keys) =>
  obj && keys.reduce((result, key) => ({ ...result, [key]: obj[key] }), {});

module.exports = { selectKeys };
