const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp(functions.config().firebase);
const fs = admin.firestore();
const slackIds = {'U66ENGK5H' : '@carlallama',
    'U7G6Y2XE3' : '@michael.field',
    'U9TEP334Y' : '@setolurie',
    'UCHELUTB8' : '@skhumatine',
    'U67BJKSFQ' : '@dominicschorr',
    'UE6NPMVU3' : '@Mahesh',
    'U66JETMTN' : '@jasanth.moodley',
    'UE8B3N7FU' : '@Tim Simons'};

let vetkoekRef = fs.collection('Vetkoek');

/**
 * Responds to any HTTP request.
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.vetkoekFunction = (req, res) => {
    return Promise.resolve()
        .then(() => {
            if (req.method !== 'POST') {
                const error = new Error('Only POST requests are accepted');
                error.code = 405;
                throw error;
            }
            else if(req.body.hasOwnProperty('challenge')){
                res.send(req.body.challenge);
                return;
            }
            else if(req.body.hasOwnProperty('event') && req.body.event.hasOwnProperty('type') && req.body.event.type === 'reaction_added' && req.body.event.reaction === 'vetkoek'){
                console.log("Message received: " + JSON.stringify(req.body));
                let fromUser = slackIds[req.body.event.user];
                let toUser = slackIds[req.body.event.item_user];
                if (toUser != undefined) {
                    console.log("Vetkoek reaction added from: " + fromUser + " to user: " + toUser);
                    return addVetkoekForUser(toUser);
                    //return giveVetkoek(fromUser, toUser);
                }
                res.status(200).send();
                return;
            }
            else {

                vetkoekRef = fs.collection('Vetkoek');

                let responseMessage = "";
                console.log("Message received: " + JSON.stringify(req.body.text));

                var words = JSON.stringify(req.body.text).split(" ");

                var vetkoeksFor = [];
                var method;
                for (var i = 0; i < words.length; i ++) {
                    var word = compress(words[i]);
                    if (word.startsWith("@")) {
                        vetkoeksFor.push(word);
                        method = "GIVE";
                    } else if ((word === "week") || (word === "current") || (word === "weekly")) {
                        method = "THISWEEK";
                        console.log("Thisweek method found");
                        break;
                    } else if ((word === "all") || (word === "time") || (word === "total") || (word === "leaderboard")) {
                        method = "ALLTIME";
                        console.log("Alltime method found");
                        break;
                    }
                }

                switch(method) {
                    case "GIVE":
                        for (var teamMember in vetkoeksFor) {
                            console.log("Give method found for: " + vetkoeksFor[teamMember]);
                            responseMessage += addVetkoekForUser(teamMember);
                        }
                        res.send(responseMessage);
                        break;
                    case "THISWEEK":
                        console.log("Thisweek method found");
                        var scores = {};
                        var unsorted = [];
                        responseMessage = "*This week's vetkoek scores!*\n";
                        return vetkoekRef.get().then(function(querySnapshot) {
                            querySnapshot.forEach(function(doc) {
                                scores[doc.id] = doc.data().thisweek;
                                unsorted.push(doc.data().thisweek);
                            });
                            res.send(scoresResponseGenerator(unsorted, scores, responseMessage));
                            return;
                        });
                        break;
                    case "ALLTIME":
                        console.log("Alltime method found");
                        var scores = {};
                        var unsorted = [];
                        responseMessage = "*All time vetkoek scores!*\n";
                        return vetkoekRef.get().then(function(querySnapshot) {
                            querySnapshot.forEach(function(doc) {
                                scores[doc.id] = doc.data().alltime;
                                unsorted.push(doc.data().alltime);
                            });
                            res.send(scoresResponseGenerator(unsorted, scores, responseMessage));
                            return;
                        });
                        break;
                    default:
                        res.send("Vetkoek is confused!");
                        return;
                }
            }
            //res.status(200).send(responseMessage);
        }).then((response) => {
            res.send(response);
        }).catch((err) => {
            console.error(err);
            res.status(err.code || 500).send(err);
            return Promise.reject(err);
        });


};

function giveVetkoek(toUser, fromUser){
    addVetkoekForUser(toUser);
}

function addVetkoekForUser(teamMember){
    return vetkoekRef
        .doc(teamMember)
        .get()
        .then(doc => {
            if (!doc.exists) {
                console.log("No such document!");

            } else {
                console.log("Document data:", doc.data());

                var currentScore = doc.data();
                currentScore.thisweek += 1;
                currentScore.alltime += 1;
                console.log("Week total: " + currentScore.thisweek + ", all time total: " + currentScore.alltime);

                vetkoekRef
                    .doc(teamMember)
                    .set(currentScore, { merge: true });

                let responseMessage = "Looks like " + teamMember + " got a vetkoek!\n";
                console.log("responseMessage: " + responseMessage);
                return responseMessage;
            }
        }).catch(err => {
            console.log("Error getting document:", err);
        });
}

function scoresResponseGenerator(unsorted, scores, responseMessage){
    var sorted = unsorted.sort((a, b) => a - b);

    sorted.forEach(function(element){
        var key = getKeyByValue(scores, element)
        console.log(key, " => ", element);
        responseMessage += key + " has " + element + " vetkoeks!\n";
        delete scores[key];
    });

    console.log("responseMessage: " + responseMessage);
    return responseMessage;
}

function isPunct(char) {
    return ";:.,?!-'\"(){}".includes(char);
}

function compress(string) {
    return string
        .split("")
        .filter(char => !isPunct(char))
        .join("");
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}