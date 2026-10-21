import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";
import { idtoSocket } from "../../mecca/ws-backend/src/state/stores";

const wss=new WebSocketServer({port:"8080"});
let rooms=new Map();
let roomData=new Map();
let uidSocket=new Map();
let uidUsername=new Map();
let voteInterval=new Map();
let userInputs=new Map();//the guesses each user is gonna make in the round ->uid and a set of user inputs 
const words = [
    "apple", "bridge", "candle", "dolphin", "engine",
    "forest", "guitar", "hammer", "island", "jacket",
    "kettle", "ladder", "magnet", "needle", "orange",
    "pencil", "quartz", "rocket", "saddle", "tiger",
    "umbrella", "violet", "wagon", "yogurt", "zebra",
    "anchor", "basket", "cactus", "dragon", "feather",
    "garden", "helmet", "insect", "jungle", "kitten",
    "lemon", "mirror", "napkin", "ocean", "parrot",
    "rabbit", "silver", "tunnel", "valley", "window",
    "yellow", "zipper", "bottle", "castle", "desert"
  ];
//no need to store the role as i can match up using the roomdata , whether they are the impostor or not 


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


function inputPhase(roomId){
    roomData.get(roomId).inputTimer=setTimeout(() => {
        const participants=rooms.get(roomId);
        //maintain a array of inputs to username
        let answers=[];

        for(const i of participants){
            let input;
            let userName=uidUsername.get(i);
            if(userInputs.get(i)){
                input=userInputs.get(i);
            }
            else{
                input="not given"
            }
            answers.push({userName:userName,input:input})
        }
        for(const i of participants){
            const sock=uidSocket.get(i);
            sock.send(JSON.stringify({
                event:"voting started",
                answers:answers

            }))
        }
    }, 20000);
}


function votingPhase(roomId){
    setTimeout(()=>{
        const participants=rooms.get(roomId);
        for(const i of participants){
            const sock=uidSocket.get(i);
            sock.send(JSON.stringify({
                event:"voting ended",
                answers:answers

            }))
        }

    },45000)
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
            //check the min length
            if(roomData.get(roomId).livePlayers<3){
                socket.send(JSON.stringify({
                    event:"not enough members"
                }))

                return;
            }
            let randomNum=Math.floor(Math.random()*words.length)
            const selectedWord=words[randomNum];
            roomData.get(roomId).selectedWord=selectedWord;
            let temp=[...rooms.get(roomId)];
            randomNum=Math.floor(Math.random()*temp.length);
            const impId=temp[randomNum];
            roomData.get(roomId).impostorId=impId;
            const users=rooms.get(roomId);
             //now after choosing the word and the impostor , time to deliver it to the respective users 
            for(const i of users){
                const sock=uidSocket.get(i);
                if(i==roomData.get(roomId).impostorId){
                    sock.send(JSON.stringify({
                        event:"game started",
                        role:"impostor"
                    }))
                }
                else{
                    sock.send(JSON.stringify({
                        event:"game started",
                        role:"crew",
                        secretWord:selectedWord
                    }))
                }
            }
            
            roomData.get(roomId).state="submissions";
            userInputs.clear(); // Clear any old inputs for this room

            for(const i of users){
                const sock=uidSocket.get(i);
                sock.send(JSON.stringify({
                    event:"input your answer"
                }))
            }
            
            // set a timeout for the submission phase here

        }
        if(payload.type=="INPUT_SUBMIT"){
          //
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