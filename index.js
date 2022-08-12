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

const blockLootTable = {
    2:['wood']
}

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

        let regionX = gameBuffer[worldId].playerData[user].region.x;
        let regionY = gameBuffer[worldId].playerData[user].region.y;
        // logGreen(nowX);
        // logGreen(nowY);
        // if (nowX+data.x < 0 || nowX+data.x > 29 || nowY+data.y < 0 || nowY+data.y > 29) {
        //     return;
        // }
        if ((nowX + data.x) < 0) {
            console.log('case 1')
            if (regionX <= 0) {
                return;
            }
            else {
                console.log(`need to generate at x: ${regionX-1} y: ${regionY}`)
                generateRegion(regionX-1,regionY,worldId,user);
                io.in(worldId).emit('player movement server',{x:29,y:0},user);
                gameBuffer[worldId].playerData[user].position.x += 29;
                return;
            }
        }
        if ((nowX + data.x) > 29) {
            console.log('case 2')
            if (regionX >= 29) {
                return;
            }
            else {
                console.log(`need to generate at x: ${regionX+1} y: ${regionY}`)
                generateRegion(regionX+1,regionY,worldId,user);
                io.in(worldId).emit('player movement server',{x:-29,y:0},user);
                gameBuffer[worldId].playerData[user].position.x -= 29;
                return;
            }
        }
        if ((nowY + data.y) < 0) {
            console.log('case 3')
            if (regionY <= 0) {
                return;
            }
            else {
                console.log(`need to generate at x: ${regionX} y: ${regionY-1}`)
                generateRegion(regionX,regionY-1,worldId,user);
                io.in(worldId).emit('player movement server',{x:0,y:29},user);
                gameBuffer[worldId].playerData[user].position.y += 29;
                return;
            }
        }
        if ((nowY + data.y) > 29) {
            console.log('case 4')
            if (regionY >= 29) {
                return;
            }
            else {
                console.log(`need to generate at x: ${regionX} y: ${regionY+1}`)
                generateRegion(regionX,regionY+1,worldId,user);
                io.in(worldId).emit('player movement server',{x:0,y:-29},user);
                gameBuffer[worldId].playerData[user].position.y -= 29;
                return;
            }
        }
        if (gameBuffer[worldId].world[gameBuffer[worldId].playerData[user].region.y][gameBuffer[worldId].playerData[user].region.x][nowY+data.y][nowX+data.x]!=0) {
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
        gameBuffer[worldId].world[gameBuffer[worldId].playerData[user].region.y][gameBuffer[worldId].playerData[user].region.x][data.y][data.x] = data.c;
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
    socket.on('player get item',(item,quan,worldId,session,user)=>{
        // let ableQuan = ableGiveItem(user,item,quan,worldId);
        // if (!ableQuan) return;

        // logRed('ok');
        // giveItem(user,item,quan,socket,worldId);
        // socket.emit('invChange',slot,item,quan);
        playerGetItem(item,quan,worldId,session,user,socket);
    })
    socket.on('player delete item',(item,quan,worldId,session,user)=>{
        if (canDeleteItem(worldId,user,item,quan)) {
            let changes = deleteItem(worldId,user,item,quan);
            let inv = gameBuffer[worldId].playerData[user].inventory;
            changes.forEach(x=>{
                console.log(inv[x]);
                socket.emit('inv change server',x,inv[x].item,inv[x].quan);
            })
        }
    })
    socket.on('break block',(worldId,user,session,x,y)=>{
        let regionX = gameBuffer[worldId].playerData[user].region.x;
        let regionY = gameBuffer[worldId].playerData[user].region.y;
        if (gameBuffer[worldId].world[regionY][regionX][y][x] === 0) {
            return;
        }
        io.in(worldId).emit('block update server',{x,y,c:0,regionX,regionY});
        // logRed(gameBuffer[worldId].world[regionY][regionX][y][x])
        // logRed(blockLootTable[gameBuffer[worldId].world[regionY][regionX][y][x]]);
        playerGetItem(blockLootTable[gameBuffer[worldId].world[regionY][regionX][y][x]],1,worldId,session,user,socket);
        logGreen('break block');
        gameBuffer[worldId].world[regionY][regionX][y][x] = 0;
    })
});

let leftQuan = 0;

function playerGetItem(item,quan,worldId,session,user,socket) {
    leftQuan = quan;
    let ableQuan = ableGiveItem(user,item,quan,worldId);
    console.log(ableQuan);
    if (!ableQuan) return;
    leftQuan -= ableQuan;
    giveItem(user,item,ableQuan,socket,worldId);
    // socket.emit('invChange',slot,item,ableQuan);
    if (leftQuan === 0) return;
    playerGetItem(item,leftQuan,worldId,session,user,socket);
    // logRed('ok');
    // socket.emit('invChange',slot,item,quan)
}

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

function ableGiveItem(user,item,quan,worldId) {
    let inv = gameBuffer[worldId].playerData[user].inventory;
    // return (gameBuffer[worldId].playerData[user].inventory.findIndex(x=>(x.item==item||x.item=='air')&&(x.quan<=100-quan))>-1)
    let firstSlot = inv.findIndex(x=>(x.item==item||x.item=='air')&&(x.quan<100));
    if (firstSlot == -1) return false;
    if (inv[firstSlot].quan == 100) {
        return false;
    }
    else {
        return Math.min(100-inv[firstSlot].quan,quan);
    }
} 

function giveItem(user,item,quan,socket,worldId) {
    let slot = gameBuffer[worldId].playerData[user].inventory.findIndex(x=>(x.item==item||x.item=='air')&&(x.quan<=100-quan))
    let inv = gameBuffer[worldId].playerData[user].inventory;
    if (inv[slot].item == item) {
        inv[slot].quan += quan;
    }
    else if (inv[slot].item == 'air') {
        inv[slot] = {item,quan};
    }
    socket.emit('inv change server',slot,item,inv[slot].quan);
}

function generateRegion(x,y,worldId,user) {
    console.log(x,y);
    if (gameBuffer[worldId].world[y][x] === 'ungenerated') {
        let newRegion = [];
        for (let y=0; y<30; y++) {
            newRegion.push([]);
            for (let x=0; x<30; x++) {
                newRegion[y].push(0);
            }
        }
        for (let x=0; x<Math.round(Math.random()*2+10); x++) {
            let randX = Math.round(Math.random()*27+1);
            let randY = Math.round(Math.random()*27+1);
            if (newRegion[randY][randX] != 0 || (randX == 14 && randY == 14)) {
                x--;
                continue;
            }
            else {
                newRegion[randY][randX] = 2;
            }
        }
        gameBuffer[worldId].world[y][x] = newRegion;
        io.in(worldId).emit('generate region server',x,y,newRegion)
    }
    io.in(worldId).emit('change region server',user,x,y);
    gameBuffer[worldId].playerData[user].region.x = x;
    gameBuffer[worldId].playerData[user].region.y = y;
}

function canDeleteItem(worldId,user,item,quan) {
    let inv = gameBuffer[worldId].playerData[user].inventory;
    let sum = 0;
    inv.forEach(x=>{
        if (x.item == item) {
            sum += x.quan;
        }
    })
    return sum>=quan;
}

let needQuan = 0;

function deleteItem(worldId,user,item,quan) {
    needQuan = quan;
    let inv = gameBuffer[worldId].playerData[user].inventory;
    let changeSlots = [];
    inv.forEach((x,i)=>{
        if (needQuan <= 0) {
            return;
        }
        else {
            changeSlots.push(i);
            if (needQuan >= x.quan) {
                needQuan -= x.quan;
                inv[i] = {item:'air',quan:0};
            }
            else {
                x.quan -= needQuan;
                needQuan = 0;
            }
        }
    })
    return changeSlots;
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
                    parsedPlayerData[user] = {region:{x:0,y:0},position:{x:Math.round(Math.random()*10+10),y:Math.round(Math.random()*10+10)},facing:0,inventory:inventory};
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
                        parsedPlayerData[user] = {region:{x:0,y:0},position:{x:14,y:14},facing:0,inventory:inventory};
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
            world[a].push('ungenerated');
        }
    }
    let reg = [];
    for (let a=0; a<30; a++) {
        reg.push([]);
        for (let b=0; b<30; b++) {
            reg[a].push(0);
        }
    }
    for (let x=0; x<Math.round(Math.random()*2+10); x++) {
        let randX = Math.round(Math.random()*27+1);
        let randY = Math.round(Math.random()*27+1);
        if (reg[randY][randX] != 0 || (randX==14 && randY==14)) {
            x--;
            continue;
        }
        else {
            reg[randY][randX] = 2;
        }
    }
    world[0][0] = reg;
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



