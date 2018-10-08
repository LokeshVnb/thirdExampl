var express=require('express');
var app=express();
var socket=require('socket.io');
var mysql=require('mysql');
var siofu = require("socketio-file-upload");
var portNumber=process.env.PORT||4000;
var sockets=[];
var rooms=[];
var connection=mysql.createConnection({
     host:'192.168.2.68',
     user:'root',
     password:'pass',
     database:'check',
});

connection.connect(function(err)
{
    if(err)
    {
        console.log("error occured"+err);
    }
    else
    {
        console.log("database connected succesfully");    
    }
});


app.use(siofu.router);
app.use(express.static(__dirname+"/public"));

var server=app.listen(portNumber,function()
{
   
    console.log("server get started");
})

var io=socket(server);



io.on('connection',function(socket)
{
    var uploader = new siofu();
    uploader.dir = "public/upload";
    uploader.listen(socket);
    
   uploader.on('start',function(data)
    {
    console.log("starting to upload");
    })
    uploader.on('error',function(data)
    {
        console.log(data);
    })
    uploader.on('complete',function(data)
    {
    console.log(data);
    socket.emit("onComplete",{file:data.file.name});
   })

   socket.on('file_uploaded',function(data)
{
    socket.broadcast.to(data.roomid).emit("file_transfer",{file:data.file});
})

    console.log("socket is connected"+socket.id);
    socket.on("name",function(data)
    {
        //socket.username=data.name;
        
        console.log("your name is"+socket.username);    
    })
    socket.on('create_seesion',function(data)
    {
        //get the room from database while allocating for the coach from database
        console.log(data.username+" create session");
        connection.query("SELECT roomid FROM coach WHERE username='"+data.username+"'",function(err,rs,fields)
        {
            if(err)
            {
                console.log(err);
            }
            else{
            console.log("fields "+ rs[0].roomid);
            
            socket.username=data.username;
            socket.join(rs[0].roomid);
            socket.emit("create_seesion",{message:"u are created session",roomid:rs[0].roomid,sess_id:data.sess_id,username:data.username});
            //update the coach for online status.
            
            var sql="UPDATE coach SET connection_status='online',socketid='"+socket.id+"',sess_id='"+data.sess_id+"' WHERE username='"+data.username+"'"; 
            var sql2="UPDATE student SET sess_id='"+data.sess_id+"' WHERE coach_id='"+data.username+"'"; 
            connection.query(sql,function(err,rs,fields){});
            connection.query(sql2,function(err,rs,fields){});
        }
        });
       
        
    })
    socket.on('join_seesion',function(data)
    {
        //get the room from database while allocating for the coach from database
        console.log(data.username);
        connection.query("SELECT roomid,sess_id FROM student WHERE username='"+data.username+"'",function(err,rs,fields)
        {
            if(err)
            {
                console.log(err);
            }
            else{
            console.log("fields "+ rs[0].roomid);
            var room=io.nsps['/'].adapter.rooms[rs[0].roomid];
            var sess_id=rs[0].sess_id;
            if(room&&room.length>=1&&sess_id!=null)
            {
            socket.username=data.username;
            console.log("joined success"+data.username);
            socket.join(rs[0].roomid);
            socket.emit("join_seesion",{message:"u are join session",roomid:rs[0].roomid,sess_id:sess_id,username:data.username});
            var sql="UPDATE student SET connection_status='online',socketid='"+socket.id+"' WHERE username='"+data.username+"'"; 
            connection.query(sql,function(err,rs,fields){});
            }
        }
        });
       
        
    })

    socket.on('chat',function(data)
    {
        console.log("room id message "+data.roomid+"message is "+data.message);
       
        socket.to(data.roomid).emit('chat',{message:data.message,username:data.username}); 
        var post  = {sess_id:data.sess_id,username:data.username,from:"",to:"",message:data.message};
        var sql="INSERT INTO session SET ?";
        connection.query(sql,post,function(err,rs,fields){console.log(err)});       
    })

    socket.on('move',function(data)
    {
        console.log(data.move+","+data.source+","+data.target+","+data.username+",socket_username "+socket.username);
        console.log(data.fen);
        var post  = {sess_id:data.sess_id,username:data.username,from:data.source,to:data.target,message:""};
        var sql="INSERT INTO session SET ?";    
        connection.query(sql,post,function(err,rs,fields){console.log(err)});
        socket.broadcast.to(data.roomid).emit('move',{
            move:data.move,
            source:data.source,
            target:data.target,
            fen:data.fen});
        
    })

    socket.on('move_req',function(data)
    {
        var sql="SELECT * FROM session WHERE sess_id='"+data.session+"'";    
        connection.query(sql,function(err,rs,fields){
            console.log(rs);
            socket.emit('move_req',rs);
        });
    })

   
    socket.on('disconnect',function()
    {
        console.log("your name is disconnected "+socket.username+" "+socket.id);
        if(isRealString((socket.username)))
        {
        if((socket.username).includes("s"))
        {
       
        var sql2="UPDATE student SET connection_status='offline' WHERE username='"+socket.username+"'";  
        connection.query(sql2,function(err,rs,fields){});
        console.log("student disconnected");
         }
         else
         {
            var sql="UPDATE coach SET connection_status='offline' WHERE username='"+socket.username+"'";
            connection.query(sql,function(err,rs,fields){});
            console.log("coach disconnected");
         }
        }
    })
});

var isRealString=(str)=>
{
    return typeof str==='string'&&str.trim().length>0;
}