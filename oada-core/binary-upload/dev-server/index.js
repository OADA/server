const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const fs = require('fs');

const app = express();
const port = 8000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());
app.use(cors());

app.get('/', (req, res) => res.json({
  status: 'Ack',
  res: 'GET',
}));

app.post('/', (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({
      status: 'Nack',
      res: 'POST'
    });
  }

  let sampleFile = req.files.file;
  console.log(sampleFile);
  sampleFile.mv(`./uploads/${sampleFile.name}`, (e) => {
    if (e) {
      console.error(e);
      return res.status(500).send(e)
    }
    res.json({
      status: 'Ack',
      res: 'POST',
    });
  });
});

fs.mkdir(__dirname + '/uploads', 744, err => {
  if (err) {
    console.error(err);
  }
});

app.listen(port, () => console.log(`Example app listening on port ${port}`));
