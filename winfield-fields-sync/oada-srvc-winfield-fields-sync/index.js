const datasilo = require('./datasilo.js');
const wicket = require('wicket');
var wkt = new wicket.Wkt();
let path = 'grower';
let query = { expand: 'farm,field,season,boundary'};
return datasilo.get(path, query).then((res) => {
  res.data[0].farm.forEach((f) => {
    if (f.field) {
      f.field.forEach((field) => {
        let go = (new wicket.Wkt(field.boundary[0].boundary)).toJson();
      })
    }
  })

}).catch(res => {
  if (res.status === 304) {
    console.log('Received 304 Not Modified');
    return;
  }
	//console.log('ERROR: failed to get growers.  err = ', res);
});
