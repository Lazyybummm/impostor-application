import { WebSocketServer } from "ws";

const wss=new WebSocketServer({port:"8080"});
let rooms=new Map();
let roomData=new Map();

//need to be some metadata about the room here too , should be maintained 


wss.on("connection",(socket)=>{
    socket.on("message",(message)=>{
        try{
        const msg=JSON.parse(message);
        const payload=msg;
        if(payload.type=='JOIN_ROOM'){
           
            const userName=payload.userName
            const roomId=payload.roomId;
            if(rooms.get(roomId)){
                rooms.get(roomId).add(userName)
                roomData.get(roomId).livePlayers++;
            }
            else{
                 //if the room does'nt exists(a fresh room);
                 rooms.set(roomId,new Set());
                 rooms.get(roomId).add(userName);
                 roomData.set(roomId,{
                    roomId:roomId,
                    state:'created',
                    livePlayers:1,
                    hostUsername:userName,//need to make sure that this is 
                    createdAt:Date.now()
                 })
                 socket.send(JSON.stringify({
                    status:"success",
                    msg:"successfully joined the room",
                    participants:rooms.get(roomId)
                 }))

            }
        }

        if(payload.type=='START_ROOM'){

        }
    }   
        catch(e){
            socket.send(JSON.stringify({
                event:"error occured",
                error:e.message
            }))
        }
           

            //not handling room joining after leaving as of now 


        

    })
})

