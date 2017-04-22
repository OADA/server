const kf = require('kafka-node');
const Promise = require('bluebird');

//                             zookeeper     , user's name for application
const client = Promise.promisifyAll(new kf.Client("zookeeper:2181","aaron-testing-kafka"));



const producer = Promise.promisifyAll(new kf.Producer(client, { partitionerType: kf.Producer.PARTITIONER_TYPES.keyed })); // partitions based on keys

// Send 5 messages
producer.on('ready', () => {
  return producer.createTopicsAsync(['testtopic1'], true)
  .then(data => {
    console.log('createtopics returns data = ', data);
    return client.refreshMetadataAsync(['testtopic1']);
  }).then(data => {
    console.log('refreshmetadata returns data = ', data);
    return [0,1,2,3,4];
  }).map(i => {
    console.log('producing message '+i);
    return producer.sendAsync( [ 
      { topic: 'testtopic1', messages: [ new kf.KeyedMessage(''+i,'message number '+i) ] },
    ]).then(data => console.log('after send, data = ', data))
  });
});

// Consume messages
const consumer = new kf.ConsumerGroup({
  host: 'zookeeper:2181', 
  groupId: 'consume-group-1',
  protocol: [ 'roundrobin' ],
  fromOffset: 'earliest', // or latest
  sessionTimeout: 15000,
}, [ 'testtopic1' ]);

consumer.on('message', msg => {
  console.log('received consumer message = ', msg, ', key = ', msg.key.toString());
});

