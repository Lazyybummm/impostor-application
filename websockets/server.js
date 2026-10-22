import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";
import http from "http";

// 1. Create HTTP Server for the cron ping
const server = http.createServer((req, res) => {
    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Server is awake!');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// 2. Attach WebSocket Server
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ server });

let rooms=new Map();
let roomData=new Map();
let uidSocket=new Map();
let uidUsername=new Map();
let votes=new Map();
let userInputs=new Map();

// Organized by Categories
const wordPacks = {
    "Food": ["apple", "orange", "lemon", "yogurt", "castle", "desert"],
    "Places": ["bridge", "forest", "island", "garden", "tunnel", "valley", "castle", "desert"],
    "Animals": ["dolphin", "tiger", "zebra", "kitten", "parrot", "rabbit", "insect"],
    "Objects": ["candle", "engine", "guitar", "hammer", "jacket", "kettle", "ladder", "magnet", "needle", "pencil", "quartz", "rocket", "saddle", "umbrella", "wagon", "anchor", "basket", "cactus", "feather", "helmet", "mirror", "napkin", "silver", "window", "yellow", "zipper", "bottle"]
};

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
        if(sock && sock.readyState === 1) {
            sock.send(JSON.stringify({
                event: "voting started",
                answers: answers
            }));
        }
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
        if(!sock || sock.readyState !== 1) continue;
        
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
            if(!sock || sock.readyState !== 1) continue;

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
            if(sock && sock.readyState === 1) {
                sock.send(JSON.stringify({
                    event:"impostor won",
                    impostorUsername:impostorUsername,
                    secretWord: roomData.get(roomId).selectedWord // <-- Added secretWord here for the reveal screen
                }))
            }
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
                const sock=uidSocket.get(user);
                if(sock && sock.readyState === 1) {
                    sock.send(JSON.stringify({
                        event:"teammate disconnect",
                        userName:userName
                    }))
                }
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
            
            // Get categories and pick a random one
            const categories = Object.keys(wordPacks);
            const randomCatIndex = Math.floor(Math.random() * categories.length);
            const selectedCategory = categories[randomCatIndex];
            
            // Get a random word from the selected category
            const wordsInCat = wordPacks[selectedCategory];
            const randomWordIndex = Math.floor(Math.random() * wordsInCat.length);
            const selectedWord = wordsInCat[randomWordIndex];
            
            roomData.get(roomId).selectedWord = selectedWord;
            roomData.get(roomId).category = selectedCategory;

            let temp=[...rooms.get(roomId)];
            let randomNum=Math.floor(Math.random()*temp.length);
            const impId=temp[randomNum];
            roomData.get(roomId).impostorId=impId;
            const users=rooms.get(roomId);
            
             //now after choosing the word and the impostor , time to deliver it to the respective users 
            for(const i of users){
                const sock=uidSocket.get(i);
                if(i==roomData.get(roomId).impostorId){
                    sock.send(JSON.stringify({
                        event:"game started",
                        role:"impostor",
                        category: selectedCategory // <-- Sent to impostor
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
                if(sock && sock.readyState === 1) {
                    sock.send(JSON.stringify({
                        event:"someone's input",
                        input:input,
                        userName:uidUsername.get(userId)
                    }))
                }
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
            delete roomData.get(roomId).category;
            votes.delete(roomId);
            userInputs.clear();
            //need to notify everyone that new room has started
            roomData.get(roomId).state="created"
            const participants=rooms.get(roomId);
            for(const p of participants){
                const sock=uidSocket.get(p);
                if(sock && sock.readyState === 1) {
                    sock.send(JSON.stringify({
                        event:"back to lobby",
                        participants:getParticipants(roomId)
                    }))
                }
            }
        }
    }  
        catch(e){
            socket.send(JSON.stringify({
                event:"error occured",
                error:e.message
            }))
        }
    })
})

// 3. Start the combined server
server.listen(PORT, () => {
    console.log(`HTTP and WebSocket server running on port ${PORT}`);
});