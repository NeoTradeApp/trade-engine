const Papa = require("papaparse");
const axios = require("axios");

const downloadAndParseCsv = async (url) => {
  const { data } = await axios.get(url);

  const result = Papa.parse(data, {
    header: true,
    skipEmptyLines: true
  });

  return result?.data;
}

module.exports = { downloadAndParseCsv }
