const fs = require('fs')
const moment = require('moment')

const getDate = () => {
  return moment().format('YYYY-MM-DD')
}

const getDT = () => {
  return moment().format('YYYY-MM-DD HH:mm:ss')
}

const log = async (data) => {
  const isLogFolderExists = await isFolder('logs')
  if (!isLogFolderExists) {
    await fs.promises.mkdir('logs')
  }
  const content = `[${getDT()}] >> ` + (((typeof data == 'object') ? JSON.stringify(data) : data) + "\n")
  console.log(content)
  await fs.promises.appendFile(`logs/log-${getDate()}.log`, content)
}


const isFolder = async (path) => {
  const result = await fs.promises.stat(path).catch(err => {
    if (err.code === 'ENOENT') {
      return false;
    }
    throw err;
  });
  return !result ? result : result.isDirectory();
}

module.exports = {
  isFolder,
  log
}
