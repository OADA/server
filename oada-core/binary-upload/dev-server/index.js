/*
 * 
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const bluebird = require('bluebird');

const readfile = bluebird.promisify(fs.readFile);

const app = express();
const port = 8000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());
app.use(cors());

app.get('/', (_req, res) => res.json({
  status: 'Ack',
  res: 'GET',
}));

app.post('/', async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).json({
      status: 'NACK',
      res: 'POST'
    });
  }

  // console.log(req);
  // 'Begin': octet stream beginning location in file
  // console.log(req.files.file);
  // const buf = Array.from(new Uint8Array(req.files.file.data));
  // console.log(buf);

  let f = req.files.file;
  delete f.mv;
  delete f.md5;
  delete f.tempFilePath;

  // const buf = Buffer.from(f.data, 'base64');
  // console.log(buf);
  const arr = Array.from(f.data);
  // console.log(arr);

  f.data = arr;

  console.log(f);

  const buf2 = new Buffer.from(arr);
  // console.log(buf2);

  const file_writer = fs.createWriteStream(`${__dirname}/uploads/${req.files.file.name}`);
  file_writer.write(buf2);

  res.status(200).json({
    status: 'ACK',
    res: 'POST'
  });

  /*
  TODO use tmp/ directory
  let receivedFile = req.files.file;
  receivedFile.mv(`./uploads/${receivedFile.name}`, (e) => {
    if (e) {
      console.error(e);
      return res.status(500).send(e)
    }
  });
  */

  // let localFile = await readfile(`./to_upload/${receivedFile.name}`);
  // let recvFile = await readfile(`./uploads/${receivedFile.name}`);

  // check if buffer contents are equivalent
  /*
  if (recvFile.equals(localFile)) {
    // ACK => file uploaded successfully
    res
      .status(200)
      .json({
        status: 'ACK',
        res: 'POST',
    });
  } else {
    res
      .status(400)
      .json({
        status: 'NACK',
        res: 'POST',
    });
  }
  */
});

// make uploads directory
// ignore already exists errors becasue the folder we want is already available
fs.mkdir(__dirname + '/uploads', { mode: 0744 }, err => {
  if (err) {
    if (err.code !== 'EEXIST') {
      console.error(err);
    }
  }
});

app.listen(port, () => console.log(`Example app listening on port ${port}`));
