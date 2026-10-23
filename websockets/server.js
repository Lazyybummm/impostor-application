import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";
import http from "http";

const server = http.createServer((req, res) => {
    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Server is awake!');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});


const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ server });

let rooms=new Map();
let roomData=new Map();
let uidSocket=new Map();
let uidUsername=new Map();
let votes=new Map();
let userInputs=new Map();


const wordPacks = {
    "Indian Street Food": [
        { real: "Pani Puri", decoy: "Sev Puri" },
        { real: "Vada Pav", decoy: "Misal Pav" },
        { real: "Pav Bhaji", decoy: "Dabeli" },
        { real: "Jalebi", decoy: "Imarti" },
        { real: "Kachori", decoy: "Samosa" },
        { real: "Momos", decoy: "Gyoza" },
        { real: "Chole Bhature", decoy: "Amritsari Kulcha" },
        { real: "Dahi Puri", decoy: "Bhel Puri" },
        { real: "Kathi Roll", decoy: "Shawarma" },
        { real: "Cutting Chai", decoy: "Filter Coffee" },
        { real: "Kulfi Falooda", decoy: "Ice Gola" },
        { real: "Aloo Tikki", decoy: "Ragda Pattice" },
        { real: "Maggi", decoy: "Top Ramen" },
        { real: "Sugarcane Juice", decoy: "Nimbu Pani" },
        { real: "Bun Maska", decoy: "Rusk" }
    ],
    "90s Nostalgia": [
        { real: "Doordarshan", decoy: "Cartoon Network" },
        { real: "Shaktimaan", decoy: "Captain Vyom" },
        { real: "Tazos", decoy: "Pogs" },
        { real: "Walkman", decoy: "Discman" },
        { real: "Cassette Tape", decoy: "Floppy Disk" },
        { real: "Nokia 3310", decoy: "Nokia 1100" },
        { real: "Gully Cricket", decoy: "Book Cricket" },
        { real: "Parle-G", decoy: "Marie Gold" },
        { real: "Rasna", decoy: "Tang" },
        { real: "Antakshari", decoy: "Dumb Charades" },
        { real: "Chacha Chaudhary", decoy: "Tinkle" },
        { real: "Champak", decoy: "Chandamama" },
        { real: "Brick Game", decoy: "Snake Game" },
        { real: "Hero Pen", decoy: "Reynolds Pen" },
        { real: "Pager", decoy: "Landline Phone" }
    ],
    "Global Travel": [
        { real: "Santorini", decoy: "Mykonos" },
        { real: "Machu Picchu", decoy: "Petra" },
        { real: "Burj Khalifa", decoy: "Shanghai Tower" },
        { real: "Colosseum", decoy: "Parthenon" },
        { real: "Venice Gondola", decoy: "Amsterdam Canal Cruise" },
        { real: "Bali", decoy: "Phuket" },
        { real: "Taj Mahal", decoy: "Humayun's Tomb" },
        { real: "Northern Lights", decoy: "Midnight Sun" },
        { real: "Great Wall", decoy: "Angkor Wat" },
        { real: "Sagrada Familia", decoy: "Notre-Dame" },
        { real: "Niagara Falls", decoy: "Victoria Falls" },
        { real: "Maldives", decoy: "Seychelles" },
        { real: "Shibuya Crossing", decoy: "Times Square" },
        { real: "Leh Ladakh", decoy: "Spiti Valley" },
        { real: "Big Ben", decoy: "Tower Bridge" }
    ],
    "Pop Culture": [
        { real: "Shah Rukh Khan", decoy: "Salman Khan" },
        { real: "Sholay", decoy: "Deewar" },
        { real: "Gangs of Wasseypur", decoy: "Sacred Games" },
        { real: "Breaking Bad", decoy: "Better Call Saul" },
        { real: "Squid Game", decoy: "Alice in Borderland" },
        { real: "Game of Thrones", decoy: "House of the Dragon" },
        { real: "Taylor Swift", decoy: "Ariana Grande" },
        { real: "Barbie", decoy: "Oppenheimer" },
        { real: "Mirzapur", decoy: "Panchayat" },
        { real: "Money Heist", decoy: "Lupin" },
        { real: "Coldplay", decoy: "Imagine Dragons" },
        { real: "Arijit Singh", decoy: "Atif Aslam" },
        { real: "Kantara", decoy: "Pushpa" },
        { real: "RRR", decoy: "Baahubali" },
        { real: "Instagram Reels", decoy: "TikTok" }
    ],
    "Office Life": [
        { real: "Standup Meeting", decoy: "Retro Meeting" },
        { real: "Zoom Call", decoy: "Teams Call" },
        { real: "Appraisal", decoy: "Increment Letter" },
        { real: "Excel Sheet", decoy: "Google Sheets" },
        { real: "Water Cooler", decoy: "Coffee Machine" },
        { real: "Cubicle", decoy: "Hot Desk" },
        { real: "Slack", decoy: "WhatsApp Group" },
        { real: "Work From Home", decoy: "Hybrid Model" },
        { real: "PowerPoint", decoy: "Canva" },
        { real: "Lanyard", decoy: "ID Card" },
        { real: "Layoffs", decoy: "Resignation" },
        { real: "Sticky Notes", decoy: "Whiteboard" },
        { real: "Office Tiffin", decoy: "Canteen Thali" },
        { real: "Notice Period", decoy: "Probation" },
        { real: "LinkedIn", decoy: "Naukri" }
    ],
    "Weird Animals": [
        { real: "Axolotl", decoy: "Salamander" },
        { real: "Pangolin", decoy: "Armadillo" },
        { real: "Platypus", decoy: "Echidna" },
        { real: "Narwhal", decoy: "Beluga" },
        { real: "Blobfish", decoy: "Anglerfish" },
        { real: "Capybara", decoy: "Beaver" },
        { real: "Komodo Dragon", decoy: "Gharial" },
        { real: "Sloth", decoy: "Koala" },
        { real: "Red Panda", decoy: "Raccoon" },
        { real: "Naked Mole Rat", decoy: "Meerkat" },
        { real: "Aye-aye", decoy: "Lemur" },
        { real: "Okapi", decoy: "Zebra" },
        { real: "Quokka", decoy: "Wallaby" },
        { real: "Mandrill", decoy: "Baboon" },
        { real: "Dumbo Octopus", decoy: "Cuttlefish" }
    ],
    "Gadgets and Tech": [
        { real: "iPhone", decoy: "Google Pixel" },
        { real: "AirPods", decoy: "Galaxy Buds" },
        { real: "PlayStation", decoy: "Xbox" },
        { real: "Kindle", decoy: "iPad" },
        { real: "Tesla", decoy: "Ola Electric" },
        { real: "Alexa", decoy: "Siri" },
        { real: "ChatGPT", decoy: "Gemini" },
        { real: "Fitbit", decoy: "Apple Watch" },
        { real: "GoPro", decoy: "DJI Drone" },
        { real: "Jio", decoy: "Airtel" },
        { real: "Nintendo Switch", decoy: "Steam Deck" },
        { real: "Starlink", decoy: "Wi-Fi Router" },
        { real: "JBL Speaker", decoy: "Bose Soundbar" },
        { real: "Raspberry Pi", decoy: "Arduino" },
        { real: "Power Bank", decoy: "Wireless Charger" }
    ],
    "Sports Arena": [
        { real: "Virat Kohli", decoy: "Rohit Sharma" },
        { real: "Lionel Messi", decoy: "Cristiano Ronaldo" },
        { real: "IPL", decoy: "Big Bash" },
        { real: "Wimbledon", decoy: "US Open" },
        { real: "Neeraj Chopra", decoy: "Usain Bolt" },
        { real: "Formula 1", decoy: "MotoGP" },
        { real: "Sachin Tendulkar", decoy: "Rahul Dravid" },
        { real: "Kabaddi", decoy: "Kho Kho" },
        { real: "FIFA World Cup", decoy: "Olympics" },
        { real: "Mary Kom", decoy: "Saina Nehwal" },
        { real: "Magnus Carlsen", decoy: "Viswanathan Anand" },
        { real: "Eden Gardens", decoy: "Wankhede Stadium" },
        { real: "Yorker", decoy: "Bouncer" },
        { real: "Real Madrid", decoy: "Barcelona" },
        { real: "Chennai Super Kings", decoy: "Mumbai Indians" }
    ],
    "Big Fat Indian Wedding": [
        { real: "Baraat", decoy: "Sangeet" },
        { real: "Mehendi", decoy: "Haldi" },
        { real: "Sherwani", decoy: "Bandhgala" },
        { real: "Lehenga", decoy: "Banarasi Saree" },
        { real: "Mangalsutra", decoy: "Sindoor" },
        { real: "Saat Phere", decoy: "Kanyadaan" },
        { real: "Wedding Planner", decoy: "Pandit Ji" },
        { real: "Shaadi.com", decoy: "Jeevansathi" },
        { real: "Paan Counter", decoy: "Chaat Counter" },
        { real: "Mandap", decoy: "Reception Stage" },
        { real: "Choora", decoy: "Kaleere" },
        { real: "Vidaai", decoy: "Griha Pravesh" },
        { real: "Shagun Envelope", decoy: "Gift Hamper" },
        { real: "Gulab Jamun", decoy: "Moong Dal Halwa" },
        { real: "Destination Wedding", decoy: "Court Marriage" }
    ]
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


    socket.on("close",()=>{
        const userId=socket.clientId;
        const roomId=socket.roomId;

        // If they never joined a room, nothing to clean up
        if(!userId || !roomId) return;

        const userName=uidUsername.get(userId);
        const participants=rooms.get(roomId);
        const room = roomData.get(roomId);

        if(!participants || !room) return;

        // Remove socket mapping immediately since connection is dead
        uidSocket.delete(userId);

        const isMidGame = room.state !== "created";

        if (!isMidGame) {
            // LOBBY STATE: Wipe them out completely
            participants.delete(userId);
            room.livePlayers--;

            if (participants.size === 0) {
                // Room is empty, wipe everything
                if (room.inputTimer) clearTimeout(room.inputTimer);
                if (room.votingTimer) clearTimeout(room.votingTimer);
                if (room.guessTimer) clearTimeout(room.guessTimer);
                rooms.delete(roomId);
                roomData.delete(roomId);
                votes.delete(roomId);
                uidUsername.delete(userId);
                userInputs.delete(userId);
                return;
            }

            // Transfer host if host left
            if (room.hostId === userId) {
                room.hostId = participants.values().next().value;
                const sock=uidSocket.get(room.hostId);
                if(sock && sock.readyState === 1) {
                    sock.send(JSON.stringify({
                        event:"you are new host"
                    }))
                }
            }

            uidUsername.delete(userId);
            userInputs.delete(userId);

        } else {
            
            if (userId === room.impostorId && room.state === "impostor-guess") {
                if (room.guessTimer) clearTimeout(room.guessTimer);
                room.winner = "crew";
                room.state = "round-end";
                guessPhase("crew", userId, roomId);
                return;
            }

            if (room.state === "submissions") {
                if (userInputs.size === participants.size - 1) {
                    clearTimeout(room.inputTimer);
                    votingPhase(roomId);
                }
            } else if (room.state === "voting") {
                if (votes.get(roomId) && votes.get(roomId).size === participants.size - 1) {
                    clearTimeout(room.votingTimer);
                    resultsPhase(roomId);
                }
            }
        }

        for(const p of participants){
            if (p === userId) continue;
            const sock=uidSocket.get(p);
            if(sock && sock.readyState === 1) {
                sock.send(JSON.stringify({
                    event:"teammate disconnect",
                    userName:userName
                }))
            }
        }
    });

    socket.on("message",(message)=>{
        try{
        const msg=JSON.parse(message);
        const payload=msg;
        if(payload.type=='JOIN_ROOM'){
            const uid=nanoid();
            uidSocket.set(uid,socket);
            const roomId=payload.roomId;
            socket.clientId=uid;
            socket.roomId=roomId;
            //setting a unique indetifier for this particular user
            uidUsername.set(uid,payload.userName);
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
                    if(sock && sock.readyState === 1) {
                        sock.send(JSON.stringify({
                            event:"new player joined",
                            userName:payload.userName
                        }))
                    }

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
            
            const participants = rooms.get(roomId);
            const room = roomData.get(roomId);
            if(!participants || !room) return;

            participants.delete(uid);
            room.livePlayers--;
            uidSocket.delete(uid);
            uidUsername.delete(uid);
            userInputs.delete(uid);

            // If last person leaves, wipe room
            if (participants.size === 0) {
                if (room.inputTimer) clearTimeout(room.inputTimer);
                if (room.votingTimer) clearTimeout(room.votingTimer);
                if (room.guessTimer) clearTimeout(room.guessTimer);
                rooms.delete(roomId);
                roomData.delete(roomId);
                votes.delete(roomId);
                return;
            }

            //transfer host 
            if (room.hostId === uid) {
                room.hostId = participants.values().next().value;
                const sock=uidSocket.get(room.hostId);
                if(sock && sock.readyState === 1) {
                    sock.send(JSON.stringify({
                        event:"you are new host"
                    }))
                }
            }

            //notify the users and the participants too 
            for(const user of participants){
                const sock=uidSocket.get(user);
                if(sock && sock.readyState === 1) {
                    sock.send(JSON.stringify({
                        event:"teammate disconnect",
                        userName:userName
                    }))
                }
            }
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
            
            // Get a random word pair from the selected category
            const pairsInCat = wordPacks[selectedCategory];
            const randomPairIndex = Math.floor(Math.random() * pairsInCat.length);
            const selectedPair = pairsInCat[randomPairIndex];
            
            roomData.get(roomId).selectedWord = selectedPair.real;
            roomData.get(roomId).decoyWord = selectedPair.decoy;
            roomData.get(roomId).category = selectedCategory;

            let temp=[...rooms.get(roomId)];
            let randomNum=Math.floor(Math.random()*temp.length);
            const impId=temp[randomNum];
            roomData.get(roomId).impostorId=impId;
            const users=rooms.get(roomId);
            
             //now after choosing the word and the impostor , time to deliver it to the respective users 
            for(const i of users){
                const sock=uidSocket.get(i);
                if(!sock || sock.readyState !== 1) continue;

                if(i==roomData.get(roomId).impostorId){
                    sock.send(JSON.stringify({
                        event:"game started",
                        role:"impostor",
                        secretWord: selectedPair.decoy // Impostor gets decoy word
                    }))
                }
                else{
                    sock.send(JSON.stringify({
                        event:"game started",
                        role:"crew",
                        secretWord:selectedPair.real // Crew gets real word
                    }))
                }
            }
            
            roomData.get(roomId).state="submissions";
            userInputs.clear(); //clear inputs

           
            
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
            delete roomData.get(roomId).decoyWord;
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