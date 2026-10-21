import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";

const wss=new WebSocketServer({port:"8080"});
let rooms=new Map();
let roomData=new Map();
let uidSocket=new Map();
let uidUsername=new Map();
let votes=new Map();
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


function votingPhase(roomId){
    const participants = rooms.get(roomId);
    let answers = [];

    for (const i of participants) {
        let input;
        let userName = uidUsername.get(i);
        if (userInputs.get(i)) {
            input = userInputs.get(i);
        } else {
            input = "not given";
        }
        answers.push({ uid: i, userName: userName, input: input });
    }

    roomData.get(roomId).answers = answers;
    roomData.get(roomId).state = "voting";

    for (const i of participants) {
        const sock = uidSocket.get(i);
        sock.send(JSON.stringify({
            event: "voting started",
            answers: answers
        }));
    }

    roomData.get(roomId).votingTimer=setTimeout(() => {
        resultsPhase(roomId);
    }, 45000);
    
}


function resultsPhase(roomId){
    let voteCounts=new Map();
    const currentvotes=votes.get(roomId);
    for(const [userId,targetId] of currentvotes)
    {
        const current =voteCounts.get(targetId)// if vote already exists then increment the counter
        if(current){
            voteCounts.set(targetId,current+1);
        }
        else{
            voteCounts.set(targetId,1);
        }
    }
    let max=0;
    let mostVoted;
    for(const [targetId,count] of voteCounts){
        if(count>max){//find the one with max count
            max=count;
            mostVoted=targetId
        }
    }

    if(mostVoted==roomData.get(roomId).impostorId){
        //impostor guess
    }
    else{
        const impostorUsername=uidUsername.get(roomData.get(roomId).impostorId);
        roomData.get(roomId).state="end";
        const participants=rooms.get(roomId);
        for(const i of participants){
            const sock=uidSocket.get(i);
            sock.send(JSON.stringify({
                event:"impostor won",
                impostorUsername:impostorUsername
            }))
        }
    }
   //this is what will run after everyone has voted 

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
            roomData.get(roomId).inputTimer = setTimeout(() => {
                votingPhase(roomId);
            }, 20000);
        }
        if(payload.type=="INPUT_SUBMIT"){
            const roomId = payload.roomId;
            const userId = socket.clientId;
            const input = payload.input;

            userInputs.set(userId, input);

            if(userInputs.size == rooms.get(roomId).size){
                clearTimeout(roomData.get(roomId).inputTimer);
                votingPhase(roomId);
            }

        }
        if(payload.type=='VOTE_SUBMIT'){
            const userId=socket.clientId;
            const targetId=payload.targetId;
            const roomId=payload.roomId;
            
            if(!votes.get(roomId)){
                votes.set(roomId, new Map());
            }
            
            votes.get(roomId).set(userId, targetId);

            if(votes.get(roomId).size == rooms.get(roomId).size){
                clearTimeout(roomData.get(roomId).votingTimer);
                resultsPhase(roomId); 
            }
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