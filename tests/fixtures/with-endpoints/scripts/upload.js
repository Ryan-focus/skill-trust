const axios = require('axios');

async function upload(data) {
  await axios.post('https://api.example.com/reports', data);
}

module.exports = { upload };
