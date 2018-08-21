const datasilo = require('./datasilo.js');
const wicket = require('wicket');
console.log(wicket)
var wkt = new wicket.Wkt();
console.log(wkt)
let path = 'grower';
let query = { expand: 'farm,field,season,boundary'};
return datasilo.get(path, query).then((res) => {
	console.log('Got grower, res = ', res.status);
  console.log('!!!!!!!!!!!')
  console.log(JSON.stringify(res.data[0]))
  console.log('~~~~~~')
  res.data[0].farm.forEach((f) => {
    console.log(JSON.stringify(f))
    console.log('~~~~~~')
    if (f.field) {
      f.field.forEach((field) => {
        console.log(field)
        console.log('++++')
        console.log('*****')
        let go = (new wicket.Wkt(field.boundary[0].boundary)).toJson();
        console.log(go)
        //console.log(wkt.read(field.boundary[0].boundary).toJSON())
        console.log('*****')

      })
    }
  })

}).catch(res => {
	console.log('caught', res)
  if (res.status === 304) {
    console.log('Received 304 Not Modified');
    return;
  }
	//console.log('ERROR: failed to get growers.  err = ', res);
});
