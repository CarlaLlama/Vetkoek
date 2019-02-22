const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp(functions.config().firebase);
const fs = admin.firestore();
const slackIds = {
    'U66ENGK5H' : '@carlallama',
    'U7G6Y2XE3' : '@michael.field',
    'U9TEP334Y' : '@setolurie',
    'UCHELUTB8' : '@skhumatine',
    'U67BJKSFQ' : '@dominicschorr',
    'UE6NPMVU3' : '@Mahesh',
    'U66JETMTN' : '@jasanth.moodley',
    'UE8B3N7FU' : '@Tim Simons',
    'UFZMBQ9JA' : '@Rob'};

const thisweekWords = ['week', 'current', 'weekly'];
const alltimeWords = ['all', 'time', 'total', 'leaderboard'];
const clearWords = ['clear', 'new', 'start'];

let vetkoekRef = fs.collection('Vetkoek');

/**
 * Responds to any HTTP request made to Slack webhook.
 * 1) TODO: Standup Decoder
 * 2) TODO: Vetkoek confirmation message
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.vetkoekFunction = (req, res) => {
    return Promise.resolve()
        .then(() => {
            console.log("Message body Content: " + JSON.stringify(req.body));

            if (req.method !== 'POST') {
                const error = new Error('Only POST requests are accepted');
                error.code = 405;
                throw error;
            }

            else if(!req.body){
                console.log("Message body undefined. Content: " + req);
                return "What are you trying to say?";
            }

            // Statement required for Slack OAuth init
            else if(req.body.challenge){
                console.log("Slack OAuth init message: " + req);
                return req.body.challenge;
            }

            else if(req.body.hasOwnProperty('event')){

                // Case: {fromUser} reacts to {toUser}'s post with :vetkoek:
                if(req.body.event.type === 'reaction_added' && req.body.event.reaction === 'vetkoek') {
                    console.log("Event body received: " + JSON.stringify(req.body));
                    let fromUser = slackIds[req.body.event.user];
                    let toUserCode = req.body.event.item_user;
                    return addVetkoekForUser(toUserCode, fromUser);
                }

                // Case: triggered when {fromUser} post contains :vetkoek: and @{toUser}
                else if(req.body.event.type === "message" && req.body.event.text){
                    if(((req.body.event.text).toString()).includes(':vetkoek:')){
                        let fromUser = slackIds[req.body.event.user];
                        let text = req.body.event.text;
                        let ids = [];
                        for (let key in slackIds) {
                            if (text.includes(key)) {
                                ids.push(key);
                            }
                        }
                        for(let i in ids){
                            addVetkoekForUser(ids[i], fromUser);
                        }
                    }
                }
            }

            // Case: /vetkoek Slash Command invoke
            else if(req.body.command === '/vetkoek'){
                let words = JSON.stringify(req.body.text).split(" ");
                let vetkoeksFor = [];

                console.log("Message received: " + JSON.stringify(req.body.text));

                for (let i = 0; i < words.length; i ++) {
                    let word = filter(words[i]);

                    if (word.startsWith("@")) {
                        vetkoeksFor.push(word);

                    } else if (thisweekWords.includes(word)) {
                        console.log("Thisweek intent found");
                        return returnScores('thisweek');

                    } else if (alltimeWords.includes(word)) {
                        console.log("Alltime intent found");
                        return returnScores('alltime');

                    } else if (clearWords.includes(word)){
                        console.log("Clear intent found");
                        return clearWeeklyVetkoeks();
                    }
                }
                return giveVetkoeks(vetkoeksFor);

            // Case: unrecognized statement
            } else {
                console.log("Vetkoek is confused!");
                return "Vetkoek is confused!";
            }

        })
        .then((response) => {
            res.send(response);
        })
        .catch((err) => {
            console.error(err);
            res.status(err.code || 500).send(err);
            return Promise.reject(err);
        });
};

function addVetkoekForUser(toUserCode, fromUser){
    let responseMessage = "";
    let toUser = slackIds[toUserCode];
    return vetkoekRef
        .doc(toUser)
        .get()
        .then(doc => {
            if (!doc.exists) {
                console.log("No such document!");

            } else {
                console.log("Document data:", doc.data());

                var currentScore = doc.data();
                currentScore.thisweek += 1;
                currentScore.alltime += 1;
                console.log(`Week total: ${currentScore.thisweek} all time total: ${currentScore.alltime}`);

                vetkoekRef
                    .doc(toUser)
                    .set(currentScore, { merge: true });

                if(fromUser) {
                    responseMessage = `Looks like ${toUser} got a vetkoek from ${fromUser}!\n`;
                } else {
                    responseMessage = `Looks like ${toUser} got a vetkoek!\n`;
                }
                console.log("responseMessage: " + responseMessage);
                return responseMessage;
            }
        }).catch(err => {
            console.log("Error getting document:", err);
        });
}

function clearWeeklyVetkoeks(){
    let responseMessage = `*Scores cleared for this week*\n`;

    return vetkoekRef
        .get()
        .then(function(querySnapshot) {
            querySnapshot.forEach(function(doc) {
                let username = doc.id;
                vetkoekRef
                    .doc(username)
                    .update({'thisweek': 0})
                    .then(() => {
                        console.log(`${username} thisweek score set to 0`);
                    });

            });
            console.log('Response message: ' + responseMessage);
            return responseMessage;
        });
}

function returnScores(scoreType){
    let unsortedScores = [];
    let responseMessage = `*${scoreType} vetkoek scores!*\n`;

    return vetkoekRef
        .get()
        .then(function(querySnapshot) {
            querySnapshot.forEach(function(doc) {
                let username = doc.id;
                let score = {};
                score[username] = doc.data()[scoreType];
                unsortedScores.push(score);
                console.log('Unsorted scores: ' + JSON.stringify(unsortedScores));
            });
            let sortedScores = unsortedScores.sort(function(a, b) {
                var aKey = (Object.keys(a))[0];
                var bKey = (Object.keys(b))[0];
                return (a[aKey] < b[bKey]) ? 1 : ((a[aKey] > b[bKey]) ? -1 : 0)
            });
            console.log('Sorted scores: ' + JSON.stringify(sortedScores));
            sortedScores.forEach(function(score) {
                var scoreKey = (Object.keys(score))[0];
                responseMessage += `${scoreKey} has ${score[scoreKey]} vetkoeks!\n`;
            });
            console.log('Response message: ' + responseMessage);
            return responseMessage;
        });
}

function isPunct(char) {
    return ";:.,?!-'\"(){}".includes(char);
}

function filter(string) {
    return string
        .split("")
        .filter(char => !isPunct(char))
        .join("");
}
