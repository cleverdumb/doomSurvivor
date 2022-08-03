const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');
const {lookup} = require('geoip-lite');

const port = 3011;

app.use(express.static('static'));
app.use(bodyParser.urlencoded({extended:true}));

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data.db',sqlite3.OPEN_READWRITE,(err)=>{
    if (err) throw err;
})

let gameBuffer = {}

server = http.Server(app);
server.listen(port);

let io = socketIO(server);
io.on('connection',(socket)=>{
    socket.on('join',(worldId)=>{
        socket.join(worldId);
        // console.log(io.sockets.adapter.rooms);
    });
    socket.on('player movement',(data,worldId,session,user)=>{
        // console.log(gameBuffer[worldId].playerData);
        // logGreen('received player movement');
        // logGreen(worldId);
        // logGreen(session);
        // console.log(gameBuffer);
        let nowX = gameBuffer[worldId].playerData[user].position.x;
        let nowY = gameBuffer[worldId].playerData[user].position.y;
        // logGreen(nowX);
        // logGreen(nowY);
        if (nowX+data.x < 0 || nowX+data.x > 29 || nowY+data.y < 0 || nowY+data.y > 29) {
            return;
        }
        if (gameBuffer[worldId].world[nowY+data.y][nowX+data.x]!=0) {
            return;
        }
        gameBuffer[worldId].playerData[user].position.x += data.x;
        gameBuffer[worldId].playerData[user].position.y += data.y;
        io.in(worldId).emit('player movement server',data,user);
    });
    socket.on('block update',(data,worldId,session,user)=>{
        logGreen(worldId);
        logGreen(user);
        // console.log(gameBuffer);
        gameBuffer[worldId].world[data.y][data.x] = data.c;
        io.in(worldId).emit('block update server',data);
    })
    // socket.on('disconnect',()=>{
    //     logRed('disconnect');
    //     socket.reconnect();
    // })
    socket.on('chat',(msg,user,worldId)=>{
        io.in(worldId).emit('chat server',msg,user);
    })
    socket.on('player turn',(reps,worldId,session,user)=>{
        io.in(worldId).emit('player turn server',reps,worldId,session,user);
    })
});

function init() {
    db.run('create table if not exists userPass (userId integer primary key autoincrement, user varchar(30) unique not null, pass varchar not null)',(err)=>{
        if (err) throw err;
        db.run('create table if not exists sessions (userId integer, user varchar, session varchar)',(err)=>{
            if (err) throw err;
            db.run('create table if not exists worlds (worldId integer not null, world varchar not null, players varchar)',(err)=>{
                if (err) throw err;
            })
        })
    })
}

init();

app.get('/',(req,res)=>{
    res.sendFile(__dirname + '/index.html');
})

app.post('/login',(req,res)=>{
    let user = req.body.user;
    let pass = req.body.pass;
    db.get('select count(*) from userPass where user=? and pass=?',[user,pass],(err,row)=>{
        if (err) throw err;
        if (row['count(*)']>0) {
            db.run('delete from sessions where user=?',[user],(err)=>{
                if (err) throw err;
                let session = Date.now().toString()+'-'+Math.round(Math.random()*1000000).toString();
                db.run('insert into sessions values((select userId from userPass where user=?),?,?)',[user,user,session],(err)=>{
                    if (err) throw err;
                    res.send({status:'success',session,user});
                })
            })
        }
        else {
            res.send({status:'failure'});
        }
    })
})

app.post('/create',(req,res)=>{
    let user = req.body.user;
    let pass = req.body.pass;
    db.get('select count(*) from userPass where user=?',[user],(err,row)=>{
        if (err) throw err;
        let userCount = row['count(*)'];
        if (userCount > 0) {
            res.send({status:'failure',reason:'user used'});
        }
        else {
            db.run('insert into userPass (user,pass) values(?,?)',[user,pass],(err)=>{
                if (err) throw err;
                res.send({status:'success'})
            })
        }
    })
})

// app.post('/join',(req,res)=>{
//     let session = req.body.session;
//     let worldId = req.body.worldId;
//     db.get('select count(*) from worlds where worldId=?',[worldId],(err,row)=>{
//         if (err) throw err;
//         if (row['count(*)']<1) {
//             logRed('no world');
//             res.send({status:'failure',reason:'world not found'});
//         }
//         else {
//             db.get('select players from worlds where worldId=?',[worldId],(err,row)=>{
//                 if (err) throw err;
//                 let current = row.players;
//                 if (current.length>0) {
//                     // logRed('yes player');
//                     db.get('select count(*) from sessions where session=?',[session],(err,row)=>{
//                         if (err) throw err;
//                         if (row['count(*)']>0) {
//                             db.get('select userId from sessions where session=?',[session],(err,row)=>{
//                                 if (err) throw err;
//                                 current += `,${row.userId}`;
//                                 db.run('update worlds set players=? where worldId=?',[current,worldId],(err)=>{
//                                     if (err) throw err;
//                                     res.send({status:'success'})
//                                     io = socketIO(server);
//                                     io.on('connection',(socket)=>{
//                                         console.log(socket.id);
//                                         socket.join(worldId);
                                        
//                                     })
//                                 })
//                             })
//                         }
//                         else {
//                             res.send({status:'failure',reason:'incorrect session'});
//                         }
//                     })
                    
//                 }
//                 else {
//                     // logRed('no player');
//                     db.get('select count(*) from sessions where session=?',[session],(err,row)=>{
//                         if (err) throw err;
//                         if (row['count(*)']>0) {
//                             // logRed('found session');
//                             db.get('select userId from sessions where session=?',[session],(err,row)=>{
//                                 if (err) throw err;
//                                 current += row.userId;
//                                 // db.get('select world,worldId from ')
//                                 db.run('update worlds set players=? where worldId=?',[current,worldId],(err)=>{
//                                     if (err) throw err;
//                                     res.send({status:'success'})
//                                     io = socketIO(server);
//                                     io.on('connection',(socket)=>{
//                                         console.log(socket.id);
//                                         socket.join(worldId);
//                                     })
//                                 })
//                             })
//                         }
//                         else {
//                             // logRed('no session');
//                             res.send({status:'failure',reason:'incorrect session'});
//                         }
//                     })
//                 }
//             })
//         }
//     })
// })

app.post('/join',(req,res)=>{
    // console.log(lookup(req.headers['x-forwarded-for']));
    let {session,worldId,user} = req.body;
    // console.log(session,worldId);
    db.get('select count(*) from worlds where worldId=?',[worldId],(err,row)=>{
        if (err) throw err;
        if (row['count(*)']>0) {
            // console.log(gameBuffer);
            if (gameBuffer.hasOwnProperty(worldId)) {
                // console.log(gameBuffer[worldId].playerList)
                gameBuffer[worldId].playerList.push(user);
                // console.log(gameBuffer[worldId].playerList);
                let parsedPlayerData = gameBuffer[worldId].playerData;
                if (!parsedPlayerData.hasOwnProperty(user)) {
                    let inventory = [];
                    for (let a=0; a<40; a++) {
                        inventory.push({item:'air',quan:0});
                    }
                    parsedPlayerData[user] = {position:{x:Math.round(Math.random()*10+10),y:Math.round(Math.random()*10+10)},facing:0,inventory:inventory};
                }
                gameBuffer[worldId].playerData = parsedPlayerData;
                let filteredData = {};
                // console.log(gameBuffer[worldId].playerList);
                for (x in parsedPlayerData) {
                    if (gameBuffer[worldId].playerList.includes(x)) {
                        filteredData[x] = parsedPlayerData[x];
                    }
                }
                // console.log(filteredData);
                // console.log(parsedPlayerData);
                // console.log(gameBuffer);
                res.send({status:'success',world:gameBuffer[worldId].world,playerData:filteredData});
                // console.log(gameBuffer[worldId].playerList);
                io.in(worldId).emit('join server',user,session,filteredData);
                // console.log(gameBuffer);
            }
            else {
                db.get('select world,playerData from worlds where worldId=?',[worldId],(err,row)=>{
                    if (err) throw err;
                    // console.log(row.world);
                    gameBuffer[worldId] = {playerList:[user],world:JSON.parse(row.world)};
                    let parsedPlayerData = JSON.parse(row.playerData);
                    if (!parsedPlayerData.hasOwnProperty(user)) {
                        let inventory = [];
                        for (let a=0; a<40; a++) {
                            inventory.push({item:'air',quan:0});
                        }
                        parsedPlayerData[user] = {position:{x:Math.round(Math.random()*10+10),y:Math.round(Math.random()*10+10)},facing:0,inventory:inventory};
                    }
                    gameBuffer[worldId].playerData = parsedPlayerData;
                    let filteredData = {};
                    for (x in parsedPlayerData) {
                        if (gameBuffer[worldId].playerList.includes(x)) {
                            filteredData[x] = parsedPlayerData[x];
                        }
                    }
                    // console.log(filteredData);
                    res.send({status:'success',world:gameBuffer[worldId].world,playerData:filteredData});
                    // console.log(gameBuffer[worldId].playerList);
                    io.in(worldId).emit('join server',user,session,filteredData);
                    // console.log(gameBuffer);
                })
            }
        }
        else {
            res.send({status:'failure',reason:'world not found'});
        }
    })
})

app.post('/createWorld',(req,res)=>{
    let id = Math.round(Date.now()*1000)/1000 + Math.round(Math.random()*1000);
    let world = [];
    for (let a=0; a<30; a++) {
        world.push([]);
        for (let b=0; b<30; b++) {
            world[a].push(0);
        }
    }
    world = JSON.stringify(world);
    db.run('insert into worlds values(?,?,?)',[id,world,JSON.stringify({})],(err)=>{
        if (err) throw err;
        res.send({status:'success',worldId:id});
    })
})

app.post('/leave',(req,res)=>{
    let {session,worldId,user} = req.body;
    // console.log(worldId);
    // console.log(session);
    if (gameBuffer.hasOwnProperty(worldId)) {
        if (gameBuffer[worldId].playerList.includes(user)) {
            gameBuffer[worldId].playerList = gameBuffer[worldId].playerList.filter(x=>x!=user);
            // if (gameBuffer[worldId].playerList.length<1) {
                db.run('update worlds set world=?,playerData=? where worldId=?',[JSON.stringify(gameBuffer[worldId].world),JSON.stringify(gameBuffer[worldId].playerData),worldId],(err)=>{
                    if (err) throw err;
                    io.sockets.in(worldId).emit('leave server',user);
                });
            // }
        }
        else {
            res.send({status:'failure',reason:'who are you'})
        }
    }
    else {
        res.send({status:'failure',reason:'You are not even playing that world'});
    }
})

function logGreen(txt) {
    console.log('\u001b[' + 32 + 'm' + txt + '\u001b[0m')
}

function logRed(txt) {
    console.log('\u001b[' + 31 + 'm' + txt + '\u001b[0m')
}

// app.listen(port,()=>{
//     console.log(`App running on ${port}`);
// })



