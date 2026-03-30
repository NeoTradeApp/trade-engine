const selectKeys = (obj, ...keys) =>
  obj && keys.reduce((result, key) => ({ ...result, [key]: obj[key] }), {});

const getErrorMessage = (errorObj, ...keys) => {
  const keysToMatch = ["message"].concat(keys);

  const regexToMatch = new RegExp(`"(${keysToMatch.join("|")})":\s*"([^"]*)"`, "g");
  const stringifiedError = JSON.stringify(errorObj);

  const matches = Array.from(stringifiedError.matchAll(regexToMatch));

  return matches.map(([, , match]) => match).join(". ");
};

const isEmpty = (entity) => {
  if (Array.isArray(entity)) return !entity.length;

  if (typeof entity === "object") return !Object.keys(entity).length;

  return !entity;
};

const generateRandomId = (length = 10) => {
  const chars = 'ABCDEF0123456789';
  let jobId = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    jobId += chars[randomIndex];
  }

  return jobId;
};

module.exports = { selectKeys, getErrorMessage, isEmpty, generateRandomId };
