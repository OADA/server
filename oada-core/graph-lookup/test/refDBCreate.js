'use strict'
let arangojs = require('arangojs')
let Database = arangojs.Database
let aql = arangojs.aql
//keysData - DATE,DEPARTMENT,LAST NAME,FIRST,PUID,STATUS,SUPERVISOR,BUILDING,ROOM NUMBER,KEY NUMBER,KEY IDENTIFIER
let keysData = require('./keysData/keys-data.json')
//roomsData - Bldg,Room,ShareNumber,%,Area,Department Using,Department Assigned,Sta,Room Type,Description,Internal Note
let smasData = require('./smas-data/json/smas-data.json')
let smasRoomTypesWithPeople = ['MEDIA PROD', 'NONCLAS LAB', 'OFFICE']
let _ = require('lodash')
let fs = require('fs')
const path = require('path')
let Promise = require('bluebird').Promise
let isDeveloping = process.env.NODE_ENV !== 'production'
let thePort = isDeveloping ? 3000 : process.env.PORT
let contentBase = path.resolve(__dirname, '../build')
let server_addr = process.env.ARANGODB_SERVER
  ? process.env.ARANGODB_SERVER
  : 'http://localhost:8529'
let db = new Database(server_addr)

/* ////// Person Object Example ////////////////
{
  _id: 'people/54083', 
  name: 'Jim Krogmeier' // or 'Krogmeier', 'J. Krogmeier', Currently duplicates are created for each variant
  department: 'ECE'
  keys: ['134t55'],
  status: 'F', //F for Faculty
  puid: '00003-40000',
  _type: 'person',
}
*/
let searchablePeopleAttributes = ['name', 'id', 'department', 'status']

/* ////// Room Object Example ////////////////
{
  _id: 'room/12847',
  name: 'EE 135',
  building: 'EE',
  room: '135',
  level: '1',
  area: '430',
  share: '0',
  note: '',
  type: 'OFFICE',
  percent: '100',
  assigned: 'Elec&CptEngr',
  using: 'Elec&CptEngr',
  stations: '3',
  description: 'ECE Graduate Office-M. Golden + L. Siefers + D. ',
  date: '2017-02-07T12:33:34.000Z',
  _type: 'room',
}
*/
let searchableRoomAttributes = [
  'building',
  'room',
  'id',
  'using',
  'note',
  'assigned',
  'description',
  'type'
]

/* ////// Floorplan Object Example ////////////////
{
  _id: 'floorplan/94305',
  name: 'EE 1'
  building: 'EE',
  level: '1',
  filename: 'EE_1.svg',
  _type: 'floorplan'
}
*/
let searchableFloorplanAttributes = ['building', 'level', 'name']

let roomCollection = db.collection('room')
roomCollection.drop()
let personCollection = db.collection('person')
personCollection.drop()
let floorplanCollection = db.collection('floorplan')
floorplanCollection.drop()
let buildingCollection = db.collection('building')
buildingCollection.drop()
let buildingFloorplanEdges = db.edgeCollection('buildingFloorplanEdges')
buildingFloorplanEdges.drop()
let supervisorPersonEdges = db.edgeCollection('supervisorPersonEdges')
supervisorPersonEdges.drop()
let roomPersonEdges = db.edgeCollection('roomPersonEdges')
roomPersonEdges.drop()
let roomKeyholderEdges = db.edgeCollection('roomKeyholderEdges')
roomKeyholderEdges.drop()
let floorplanRoomEdges = db.edgeCollection('floorplanRoomEdges')
floorplanRoomEdges.drop()
let floorplanViewer = db.graph('floorplan-viewer')
floorplanViewer.drop()

//Setup rooms
return (
  roomCollection
    .create()
    .then(function () {
      return getSmasRooms(smasData)
    })
    .then(function (smasRooms) {
      return populateCollection(roomCollection, smasRooms, [
        'building',
        'level',
        'room',
        'name',
        'type'
      ])
    })

    //Setup people
    .then(function () {
      return personCollection.create()
    })
    .then(function () {
      return getSmasPeople(smasData, smasRoomTypesWithPeople)
    })
    .then(function (smasPersons) {
      return populateCollection(personCollection, smasPersons, ['name'])
    })
    .then(function () {
      return getKeysDataPeople(keysData)
    })
    .then(function (keysPersons) {
      return populateCollection(personCollection, keysPersons, ['name'])
    })

    //Setup room -> person edges
    .then(function () {
      return roomPersonEdges.create()
    })
    .then(function () {
      return roomKeyholderEdges.create()
    })
    .then(function () {
      return findSmasRoomPersonEdges(
        roomCollection,
        personCollection,
        roomPersonEdges,
        smasData
      )
    })
    .then(function () {
      return findKeysDataRoomPersonEdges(
        roomCollection,
        personCollection,
        roomKeyholderEdges,
        keysData
      )
    })

    //Setup supervisor -> subordinate edges
    .then(function () {
      return supervisorPersonEdges.create()
    })
    .then(function () {
      return findSupervisorEdges(
        personCollection,
        supervisorPersonEdges,
        keysData
      )
    })

    //Setup floorplans and buildings; Setup building -> floorplan edges
    .then(function () {
      return floorplanCollection.create()
    })
    .then(function () {
      return buildingCollection.create()
    })
    .then(function () {
      return buildingFloorplanEdges.create()
    })
    .then(function () {
      return addBuildingsFloorplans(floorplanCollection, buildingCollection)
    })

    //Setup floorplan -> building edges
    .then(function () {
      return floorplanRoomEdges.create()
    })
    .then(function () {
      return findFloorplanRoomEdges(
        roomCollection,
        floorplanCollection,
        floorplanRoomEdges,
        smasData
      )
    })

    //Create fulltext indexes
    .then(function () {
      return roomCollection.createFulltextIndex('fulltext')
    })
    .then(function () {
      return personCollection.createFulltextIndex('fulltext')
    })
    .then(function () {
      return floorplanCollection.createFulltextIndex('fulltext')
    })
    .then(function () {
      return buildingCollection.createFulltextIndex('fulltext')
    })

    //Setup floorplan viewer graph
    .then(function () {
      return floorplanViewer.create({
        edgeDefinitions: [
          {
            collection: 'roomPersonEdges',
            from: ['room'],
            to: ['people']
          },
          {
            collection: 'supervisorPersonEdges',
            from: ['people'],
            to: ['people']
          },
          {
            collection: 'buildingFloorplanEdges',
            from: ['building'],
            to: ['floorplan']
          },
          {
            collection: 'floorplanRoomEdges',
            from: ['floorplan'],
            to: ['room']
          }
        ]
      })
    })
    .catch(err => {
      console.log(err)
    })
)

/* Unique SMAS Departments Assigned/Using
Aero & Astro
CmpMfg&SimCt
CnstrMgmtTch
COE PerfSpac
ComputerGrph
Cpt&InfoTech
Divrsty&Incl
Divrsty Rsrc
Gen Acad Cls
Gen Building
Elec&CptEngr
Eng Cpt Ntwk
Eng Prof Ed
Engineering
Engr BO
Engr Educ
Engr Tech
EPICS
Future Engnr
Global Engr
Indust Engr
Matl Engr
MinorityEngr
Ntwk Cmp Nan
Nucl Engr
Oper & Maint
Polytechnic
PRF Devlpmnt
Prf Std Tech
PUDiningCatr
Purdue Bound
Spns Pgm Srv
Univ Rsv Ac
VP Research
Women Engr
*/

function convertDeptName (name) {
  switch (name) {
    case 'Elec&CptEngr':
      return 'ECE'
    case 'Aero & Astro':
      return 'AAE'
    case 'Matl Engr':
      return 'MSE'
    case 'Indust Engr':
      return 'IE'
    case 'Nucl Engry':
      return 'NUC'
    case 'Eng Cpt Ntwk':
      return 'ECN'
    case 'Engineering':
      return 'COE'
    default:
      return name
  }
}

///////// Handle SMAS Data /////////////
//Each row corresponds to a room share: 1 share, 1 row; 2 shares for one room, 2 rows in the file.
function getSmasRooms (data) {
  let rooms = {}
  return Promise.each(data, function (row, i) {
    let name = row['Bldg'] + ' ' + row['Room']
    rooms[name] = rooms[name] || {
      building: row['Bldg'],
      room: row['Room'],
      level: row['Room'].charAt(0),
      name: row['Bldg'] + ' ' + row['Room'],
      area: '0',
      shares: [],
      type: row['Room Type'],
      date: row['date'] || Date.now(),
      _type: 'room'
    }
    rooms[name].area = parseInt(rooms[name].area) + parseInt(row['Area'])
    let share = parseInt(row['Share Number'])
    rooms[name].shares[share] = {
      share: row['Share Number'],
      assigned: row['Department Assigned'],
      using: row['Department Using'],
      stations: row['Sta'],
      area: row['Area'],
      percent: row['%']
    }
    if ('On Loan'.indexOf(row['Description'])) {
      rooms[name].shares[share].description = row['Internal Note']
      rooms[name].shares[share].loans = row['Description']
    } else {
      rooms[name].shares[share].description = row['Description']
      rooms[name].shares[share].note = row['Internal Note']
    }
    rooms[name].fulltext = createFullText(rooms[name], searchableRoomAttributes)
    return rooms[name]
  }).then(() => {
    return rooms
  })
}

function populateCollection (collection, data, exampleKeys) {
  return Promise.each(Object.keys(data), obj => {
    let example = {}
    exampleKeys.forEach(key => {
      example[key] = data[obj][key]
    })
    return collection.byExample(example).then(function (cursor) {
      if (cursor.count === 0) {
        return collection.save(data[obj])
      } else if (cursor.count === 1) {
        return collection.update(cursor._result[0]._id, data[obj])
      } else return null
    })
  })
}

function parsePersonsFromSmasDescription (description) {
  return description.split(/[+-]+/)
}

function getSmasPeople (smasData, smasRoomTypesWithPeople) {
  let smasPersons = {}
  return Promise.each(smasData, function (row, i) {
    // People entries should only be found in specific types of rooms
    if (smasRoomTypesWithPeople.indexOf(row['Room Type']) >= 0) {
      let persons = parsePersonsFromSmasDescription(row['Description'])
      return Promise.each(persons, function (person) {
        let name = person.trim()
        return (smasPersons[name] = {
          name: name,
          //      dept: row['Department Using'],
          _type: 'person',
          fulltext: createFullText(person, searchablePeopleAttributes)
        })
      })
    } else return null
  }).then(() => {
    return smasPersons
  })
}

// Use the keys data to find and add people to the database (each row has a keyholder and possibly their supervisor);
function getKeysDataPeople (keysData) {
  let keysPeople = {}
  return Promise.each(keysData, function (row, i) {
    //Parse out the keyholder as a person
    let keyholder = (row['FIRST'].trim() + ' ' + row['LAST NAME'].trim()).trim()
    keysPeople[keyholder] = keysPeople[keyholder] || {
      name: keyholder,
      keys: [],
      puid: row['PUID'],
      status: row['STATUS'],
      department: row['DEPARTMENT'],
      _type: 'person'
    }
    keysPeople[keyholder].keys.push(row['KEY NUMBER'])
    keysPeople[keyholder].fulltext = createFullText(
      keysPeople[keyholder],
      searchablePeopleAttributes
    )

    //Parse out the supervisor as a person
    if (row['SUPERVISOR'] && row['SUPERVISOR'].trim().length > 0) {
      let supervisor = row['SUPERVISOR'].trim()
      let name =
        supervisor[0] + supervisor.substring(1, supervisor.length).toLowerCase()
      keysPeople[name] = {
        name: name,
        _type: 'person'
      }
      keysPeople[name].fulltext = createFullText(
        keysPeople[name],
        searchablePeopleAttributes
      )
    }
    return null
  }).then(() => {
    return keysPeople
  })
}

// Create edges linking rooms to people based on the SMAS data
function findSmasRoomPersonEdges (
  roomCollection,
  personCollection,
  roomPersonEdges,
  smasData
) {
  return Promise.each(smasData, function (row, i) {
    let smasRoom = { name: row['Bldg'] + ' ' + row['Room'] }
    let smasPersons = parsePersonsFromSmasDescription(row['Description'])
    return Promise.each(smasPersons, function (person) {
      let smasPerson = { name: person.trim() }
      return roomCollection.byExample(smasRoom).then(function (roomCursor) {
        if (roomCursor.count === 0) {
          console.log('ROOM NOT FOUND:', smasRoom)
          return null
        } else if (roomCursor.count > 1) {
          console.log('MULTIPLE ROOMS FOUND: ', roomCursor._result)
          return null
        } else {
          return personCollection
            .byExample(smasPerson)
            .then(function (peopleCursor) {
              if (peopleCursor.count === 0) {
                // Not finding people in the SMAS dataset is likely okay. The Description column contained
                // non-person values for rooms of particular types (e.g. mechanical closets). These should
                // be the only ones that are caught in this part of the logic.
                //              console.log('PERSON NOT FOUND:', smasPerson);
                return null
              } else if (peopleCursor.count > 1) {
                console.log('MULTIPLE PEOPLE FOUND: ', peopleCursor._result)
                return null
              } else {
                let edge = {
                  _from: roomCursor._result[0]._id,
                  _to: peopleCursor._result[0]._id
                }
                return roomPersonEdges
                  .byExample(edge)
                  .then(function (edgeCursor) {
                    if (edgeCursor.count === 0) {
                      //                  console.log('LINKED ROOM', smasRoom.name, ' TO PERSON ', smasPerson.name);
                      return roomPersonEdges.save(edge)
                    } else {
                      //                  console.log('EDGE ALREADY FOUND: ', smasRoom.name, smasPerson.name);
                      return null
                    }
                  })
              }
            })
        }
      })
    })
  })
}

// Find Room->Person in the keys data
// This will only add edges for those rooms that are already in the database. No new rooms were
//introduced from the keysData due to presence of non-room values in the ROOM column (due to
// master keys, etc);
function findKeysDataRoomPersonEdges (
  roomCollection,
  personCollection,
  roomKeyholderEdges,
  keysData
) {
  return Promise.each(keysData, function (row, i) {
    let room = { name: row['BUILDING'] + ' ' + row['ROOM NUMBER'] }
    let keyholder = { name: row['FIRST'] + ' ' + row['LAST NAME'] }
    return roomCollection.byExample(room).then(function (roomCursor) {
      if (roomCursor.count === 0) {
        // Not finding rooms in the keys dataset is likely okay. The ROOM column may contain
        // some values that aren't strictly room numbers (e.g., master or building keys). These should
        // be the only ones that are caught in this part of the logic.
        //          console.log('ROOM NOT FOUND:', room.name);
        return null
      } else if (roomCursor.count > 1) {
        console.log('MULTIPLE ROOMS FOUND: ', roomCursor._result)
        return null
      } else {
        return personCollection
          .byExample(keyholder)
          .then(function (keyholderCursor) {
            if (keyholderCursor.count === 0) {
              console.log('KEYHOLDER NOT FOUND:', keyholder.name)
              return null
            } else if (keyholderCursor.count > 1) {
              console.log(
                'MULTIPLE PEOPLE FOUND FOR KEYHOLDER: ',
                keyholderCursor._result
              )
              return null
            } else {
              //              console.log('LINKED ROOM', room.name, ' TO PERSON ', keyholder.name);
              let edge = {
                _from: roomCursor._result[0]._id,
                _to: keyholderCursor._result[0]._id
              }
              return roomKeyholderEdges.save(edge)
            }
          })
          .then(function () {
            if (row['SUPERVISOR'] && row['SUPERVISOR'].trim().length > 0) {
              let supervisor = row['SUPERVISOR'].trim()
              supervisor = {
                name:
                  supervisor[0] +
                  supervisor.substring(1, supervisor.length).toLowerCase()
              }
              return personCollection
                .byExample(supervisor)
                .then(function (supervisorCursor) {
                  if (supervisorCursor.count === 0) {
                    console.log('SUPERVISOR NOT FOUND:', supervisor.name)
                    return null
                  } else if (supervisorCursor.count > 1) {
                    console.log(
                      'MULTIPLE PEOPLE FOUND FOR SUPERVISOR: ',
                      supervisorCursor._result
                    )
                    return null
                  } else {
                    //                  console.log('LINKED ROOM', room.name, ' TO PERSON ', supervisor.name);
                    let edge = {
                      _from: roomCursor._result[0]._id,
                      _to: supervisorCursor._result[0]._id
                    }
                    return roomKeyholderEdges.save(edge)
                  }
                })
            }
          })
      }
    })
  })
}

function findFloorplanRoomEdges (
  roomCollection,
  floorplanCollection,
  floorplanRoomEdges,
  smasData
) {
  return Promise.each(smasData, function (row, i) {
    let smasRoom = { name: row['Bldg'] + ' ' + row['Room'] }
    let smasFloorplan = { name: row['Bldg'] + ' ' + row['Room'].charAt(0) }
    return roomCollection.byExample(smasRoom).then(function (roomCursor) {
      if (roomCursor.count === 0) {
        console.log('ROOM NOT FOUND:', smasRoom)
        return null
      } else if (roomCursor.count > 1) {
        console.log('MULTIPLE ROOMS FOUND: ', roomCursor._result)
        return null
      } else {
        return floorplanCollection
          .byExample(smasFloorplan)
          .then(function (floorplanCursor) {
            if (floorplanCursor.count === 0) {
              return null
            } else if (floorplanCursor.count > 1) {
              console.log(
                'MULTIPLE FLOORPLANS FOUND: ',
                floorplanCursor._result
              )
              return null
            } else {
              let edge = {
                _from: floorplanCursor._result[0]._id,
                _to: roomCursor._result[0]._id
              }
              return floorplanRoomEdges
                .byExample(edge)
                .then(function (edgeCursor) {
                  if (edgeCursor.count === 0) {
                    //                console.log('LINKED ROOM', smasRoom.name, ' TO PERSON ', sma
                    return floorplanRoomEdges.save(edge)
                  } else {
                    // This scenario occurs because rooms with multiple shares get multiple row entries.
                    //                console.log('EDGE ALREADY FOUND: ', smasFloorplan.name, smasRoom.name)
                    return null
                  }
                })
            }
          })
      }
    })
  })
}

// Only the keys data contains person -> person relationships (supervisor -> keyholder)
function findSupervisorEdges (
  personCollection,
  supervisorPersonEdges,
  keysData
) {
  return Promise.each(keysData, function (row, i) {
    let keyholder = { name: row['FIRST'] + ' ' + row['LAST NAME'] }
    if (row['SUPERVISOR'] && row['SUPERVISOR'].trim().length > 0) {
      let supervisor = row['SUPERVISOR'].trim()
      supervisor = {
        name:
          supervisor[0] +
          supervisor.substring(1, supervisor.length).toLowerCase()
      }
      return personCollection
        .byExample(keyholder)
        .then(function (keyholderCursor) {
          if (keyholderCursor.count === 0) {
            console.log('KEYHOLDER NOT FOUND:', keyholder)
            return null
          } else if (keyholderCursor.count > 1) {
            console.log(
              'MULTIPLE PEOPLE FOUND FOR KEYHOLDER: ',
              keyholderCursor._result
            )
            return null
          } else {
            return personCollection
              .byExample(supervisor)
              .then(function (supervisorCursor) {
                if (supervisorCursor.count === 0) {
                  console.log('SUPERVISOR NOT FOUND:', supervisor)
                  return null
                } else if (supervisorCursor.count > 1) {
                  console.log(
                    'MULTIPLE PEOPLE FOUND FOR SUPERVISOR: ',
                    supervisorCursor._result
                  )
                  return null
                } else {
                  //              console.log('LINKED SUPERVISOR', supervisor.name, ' TO PERSON ', keyholder.name);
                  let edge = {
                    _from: supervisorCursor._result[0]._id,
                    _to: keyholderCursor._result[0]._id
                  }
                  return supervisorPersonEdges.save(edge)
                }
              })
          }
        })
    } else return null
  })
}

function addBuildingsFloorplans (floorplanCollection, buildingCollection) {
  let path = './svgoManSvgo/'
  let files = fs.readdirSync(path)
  let buildings = {}
  return Promise.each(files, function (file) {
    let building = file.match('^(.+)_.+.svg$')[1]
    let level = file.match('^.+_(.+).svg$')[1]
    let floorplan = {
      name: building + ' ' + level,
      building,
      level,
      filename: file,
      _type: 'floorplan'
    }
    floorplan.fulltext = createFullText(
      floorplan,
      searchableFloorplanAttributes
    )
    if (!buildings[building]) {
      buildings[building] = {
        name: building,
        levels: [level],
        fulltext: building,
        _type: 'building'
      }
    } else buildings[building].levels.push(level)
    return floorplanCollection.save(floorplan)
  }).then(function () {
    return Promise.each(Object.keys(buildings), function (building) {
      return buildingCollection.save(buildings[building]).then(function (data) {
        return Promise.each(buildings[building].levels, function (level) {
          return floorplanCollection
            .byExample({ name: building + ' ' + level })
            .then(function (cursor) {
              if (cursor.count === 0) {
                console.log('FLOORPLAN NOT FOUND:', building + ' ' + level)
                return null
              } else if (cursor.count > 1) {
                console.log(
                  'MULTIPLE PEOPLE FOUND FOR FLOORPLAN: ',
                  cursor._result
                )
                return null
              }
              let edge = { _from: data._id, _to: cursor._result[0]._id }
              return buildingFloorplanEdges.save(edge)
            })
        })
      })
    })
  })
}

// Create a fulltext searchable string of an row, given an array of keys to use
// Currently a dumb operation where row[key] should be of type string
function createFullText (row, keys) {
  let fulltext = ''
  keys.forEach(function (key) {
    if (row[key]) fulltext += ' ' + row[key]
  })
  return fulltext
}
