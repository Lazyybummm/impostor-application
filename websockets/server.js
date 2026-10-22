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
    }, 60000);
    
}


function guessPhase(winner,userId,roomId)
{
    const participants=rooms.get(roomId);
    const selectedWord=roomData.get(roomId).selectedWord;
    const impostorUsername=uidUsername.get(userId);
    for(const i of participants){
        const sock=uidSocket.get(i);
        if(winner=='impostor'){
            if(userId==i){
                sock.send(JSON.stringify({
                    event:"you win"
                }))
            }
            sock.send(JSON.stringify({
                event:"crew loses , impostor made a correct guess",
                impostorUsername:impostorUsername
            }))
        }
        else{
            if(userId==i){
                sock.send(JSON.stringify({
                    event:"you lose "
                }))
            }
            sock.send(JSON.stringify({
                event:"crew wins , impostor made a inccorrect guess",
                impostorUsername:impostorUsername
            }))

        }


    }
    
}
    //should handle the win-lose outcome and distribution 


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
        roomData.get(roomId).state="impostor-guess"
        for(const [userId,targetId] of currentvotes){
            const sock=uidSocket.get(userId);
            if(userId==mostVoted){
                sock.send(JSON.stringify({
                    event:"make a guess to win the game"
                }))
                continue;
            }
          
            sock.send(JSON.stringify({
                event:"impostor caught , waiting for the guess now "
            }))

        }
       
        roomData.get(roomId).guessTimer=setTimeout(() => {
            guessPhase("crew", mostVoted, roomId);
            roomData.get(roomId).winner = "crew";
            roomData.get(roomId).state = "round-end";
        }, 20000);

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
                 const uids=rooms.get(roomId);
                 for(const i of uids){
                    const sock=uidSocket.get(i);
                    if(i==socket.clientId){
                        continue;
                    }
                    sock.send(JSON.stringify({
                        event:"new player joined",
                        userName:payload.userName
                    }))

                 }
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
                        //send the category to the impostor so they are not completely blind , roomdata.category
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

           
            
            // set a timeout for the submission phase here
            roomData.get(roomId).inputTimer = setTimeout(() => {
                votingPhase(roomId);
            }, 60000);
        }
        if(payload.type=="INPUT_SUBMIT"){
            const roomId = payload.roomId;
            const userId = socket.clientId;
            const input = payload.input;

            userInputs.set(userId, input);
            const participants=rooms.get(roomId);
            for(const p of participants){
                if(userId==p){
                    continue;
                }
                const sock=uidSocket.get(p);
                sock.send(JSON.stringify({
                    event:"someone's input",
                    input:input,
                    userName:uidUsername.get(userId)
                }))
            }

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
        if(payload.type=='IMPOSTOR_GUESS'){
            const roomId=payload.roomId;
            const inputWord=payload.inputWord;
            const userId=socket.clientId;
            let winner;
            if(userId!==roomData.get(roomId).impostorId){
                socket.send(JSON.stringify({
                    event:"only impostor is allowed to do this action"
                }))
                return;
            }
           if(inputWord.toLowerCase()==roomData.get(roomId).selectedWord.toLowerCase())
           {
            winner='impostor';
           }
           else{
            winner='crew'
           }
            if(roomData.get(roomId).guessTimer){
                clearTimeout(roomData.get(roomId).guessTimer);
                guessPhase(winner,userId,roomId);
                roomData.get(roomId).winner=winner;
                roomData.get(roomId).state='round-end'
                
            }

        }
        if(payload.type=='PLAY_AGAIN'){
            const roomId=payload.roomId;
            const userId=socket.clientId;
            if(userId!=roomData.get(roomId).hostId){
                socket.send(JSON.stringify({
                    event:"only host is allowed to perform this action"
                }))
                return;
            }
            if(roomData.get(roomId).inputTimer){
                clearTimeout(roomData.get(roomId).inputTimer)
            }
            if(roomData.get(roomId).guessTimer){
                clearTimeout(roomData.get(roomId).guessTimer)
            }
            if(roomData.get(roomId).votingTimer){
                clearTimeout(roomData.get(roomId).votingTimer)
            }
            delete roomData.get(roomId).selectedWord;
            delete roomData.get(roomId).impostorId;
            delete roomData.get(roomId).winner;
            delete roomData.get(roomId).answers;
            votes.delete(roomId);
            userInputs.clear();
            //need to notify everyone that new room has started
            roomData.get(roomId).state="created"
            const participants=rooms.get(roomId);
            for(const p of participants){
                const sock=uidSocket.get(p);
                sock.send(JSON.stringify({
                    event:"back to lobby",
                    participants:getParticipants(roomId)
                }))
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