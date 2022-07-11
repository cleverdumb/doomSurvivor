const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const port = 3011;

app.use(express.static('static'));
app.use(bodyParser.urlencoded({extended:true}));

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data.db',sqlite3.OPEN_READWRITE,(err)=>{
    if (err) throw err;
})

function init() {
    db.run('create table if not exists userPass (userId integer primary key autoincrement, user varchar(30) unique not null, pass varchar not null)',(err)=>{
        if (err) throw err;
        db.run('create table if not exists sessions (userId integer, user varchar, session varchar)',(err)=>{
            if (err) throw err;
        })
    })
}

init();

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
                    res.send({status:'success',session});
                })
            })
        }
        else {
            res.send({status:'failure'});
        }
    })
})

app.post('/create',async (req,res)=>{
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

function logGreen(txt) {
    console.log('\u001b[' + 32 + 'm' + txt + '\u001b[0m')
}

function logRed(txt) {
    console.log('\u001b[' + 31 + 'm' + txt + '\u001b[0m')
}

app.listen(port,()=>{
    console.log(`App running on ${port}`);
})


