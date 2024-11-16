const capitalize = (text) =>
  (text && (text.charAt(0).toUpperCase() + text.slice(1))) || '';

const titleize = (text, separator = '_') =>
  (text && text.split(separator).map(capitalize).join(' ')) || '';

const changeCase = (text, { separator }) =>
  text.match(/[A-Z][a-z0-9]+/g).map((match) => match.toLowerCase()).join(separator || '_');

module.exports = { capitalize, titleize, changeCase };
