import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";

const wss=new WebSocketServer({port:"8080"});
let rooms=new Map();
let roomData=new Map();
let uidSocket=new Map();
let uidUsername=new Map();


//need to be some metadata about the room here too , should be maintained 
function getParticipants(roomId){
    const usersIds=rooms.get(roomId);
    const nameArray=[];
    for(const i of usersIds){
        const name=uidUsername.get(i);
        nameArray.push(name); 
    }

    return nameArray;
}

wss.on("connection",(socket)=>{
    socket.on("message",(message)=>{
        try{
        const msg=JSON.parse(message);
        const payload=msg;
        if(payload.type=='JOIN_ROOM'){
            const uid=nanoid();
            uidSocket.set(uid,socket);
            socket.clientId=uid;//setting a unique indetifier for this particular user
            uidUsername.set(uid,payload.userName);
            const roomId=payload.roomId;
            if(rooms.get(roomId)){
                rooms.get(roomId).add(uid)
                roomData.get(roomId).livePlayers++;
                socket.send(JSON.stringify({
                    status:"success",
                    msg:"successfully joined the room",
                    participants:getParticipants(roomId)
                 }))
            }
            else{
                 //if the room does'nt exists(a fresh room);
                 rooms.set(roomId,new Set());
                 rooms.get(roomId).add(uid);
                 roomData.set(roomId,{
                    roomId:roomId,
                    state:'created',
                    livePlayers:1,
                    hostId:uid,//need to make sure that this is 
                    createdAt:Date.now()
                 })
                 socket.send(JSON.stringify({
                    status:"success",
                    msg:"successfully joined the room",
                    participants:getParticipants(roomId)
                 }))

            }
        }

        if(payload.type=='EXIT_ROOM'){
            const uid=socket.clientId;
            const roomId=payload.roomId;
            const userName=uidUsername.get(uid);
            rooms.get(roomId).delete(uid);
            //notify the users and the participants too 
            const participants=rooms.get(roomId);//get the remaining users uid
            for(const user of participants){
                const sock=uidSocket.get(user);;
                sock.send(JSON.stringify({
                    event:"teammate disconnect",
                    userName:userName
                }))
            }
            roomData.get(roomId).livePlayers--;
        }

        if(payload.type=='START_ROOM'){
            const userId=socket.clientId;
            const roomId=payload.roomId;
            if(roomData.get(roomId).hostId!=userId){
                socket.send(JSON.stringify({
                    event:"not authorized"
                }))
                return;
            }
            //set the room state to started 
            //spin up the random word picker section 
            //get participants , use a random array idnex to pick one ->set their uid  in the room state and while sending the word , make sure to exclude them 
            //regsiter a local cron to be sent to any random participant to start saying hints for their respective word 

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

