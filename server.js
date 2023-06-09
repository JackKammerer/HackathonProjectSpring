//Required; no errors
const path = require('path')
const express = require('express')
const session = require('express-session')
const fs = require('fs')
const { spawn } = require("child_process")

const app = express()
const port = 3000;

app.use(express.static('front_end'))
app.use(express.json())

var users = JSON.parse(fs.readFileSync("users.json"))

var sets = JSON.parse(fs.readFileSync("sets.json"))


//AI Configurations; DO NOT CHANGE

const { Configuration, OpenAIApi } = require("openai")


//------------------------------------------------------------------------
//=-------------------------------- API KEY ------------------------------
//------------------------------------------------------------------------
//------------------------------------------------------------------------
var API_KEY = ""

const configuration = new Configuration({
	apiKey: API_KEY
})			
const openai = new OpenAIApi(configuration)


const runPrompt = async(question, def1, def2) => {

	const prompt = `The word ` + question + ` is defined as `+ def1 + `. Does the following statement define the previous word in a similar way to its given definition? Here is the statement: 

	` +  def2 + `
	
	Please answer in one word, either "Yes" or "No" `

	var response = await openai.createCompletion({
			model: "text-davinci-003",
			prompt: prompt,
			max_tokens: 200,
			temperature: 1
	})
	
	a = response.data.choices[0].text

	if (a.replace("\n", "").replace("\n", "") === "Yes") {
		return [1]
	}
	else {
		return [0, question]
	}
}




//Create a session, with the secret key; needs more research, but too busy right now
app.use(session({
    secret: 'lafjsa;flje909fjanonra65434378oni',
    resave: false,
    saveUninitialized: true
}))

//Make sure the user is logged in before forwarding to a webpage
const protectRoute = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/');
    }
  }

//HTML for default
app.get("/", function(req, res) {
    res.status(200).sendFile(path.join(__dirname, "front_end", "quizzlerlogin.html"))
})

//If attempting to log in, need username and password
app.post('/', function(req, res) {
    var { username, password } = req.body;

	if (users[username] === password) {
        	res.status(200)
        	req.session.isLoggedIn = true
			req.session.userId = username
        	res.redirect('/home')
    	}
	else {
		res.status(400).send('Invalid username or password');
	}
})


//If registering, add to list of users and create their basic set
app.post("/register", function(req, res) {
	var { username, password } = req.body
	
	users[username] = password
	
	fs.writeFile("./users.json", JSON.stringify(users), function(err) {
		if (err) {
			console.log("Unable to append to file!")
		}
	})

	sets[username] = {}

	fs.writeFile("./sets.json", JSON.stringify(sets), function(err) {
		if (err) {
			console.log("Unable to create new set!")
		}
	})
})

//HTML for the home page, is protected
app.get("/home", protectRoute, function(req, res) {
    res.status(200).sendFile(path.join(__dirname, "front_end", "frontpage.html"))
})

//HTML to create a set
app.get("/create", protectRoute, function(req, res) {
    res.status(200).sendFile(path.join(__dirname, "front_end", "makeset.html"))
})

//HTML to view a set
app.get("/view", protectRoute, function(req, res) {
    res.status(200).sendFile(path.join(__dirname, "front_end", "viewset.html"))
})

//HTML to create the quiz
app.get("/quiz", protectRoute, function(req, res) {
	res.status(200).sendFile(path.join(__dirname, "front_end", "quiz.html"))
})

app.post("/createNewSet", protectRoute, function(req, res) {
	var a = sets[req.session.userId]
	a[Object.keys(a).length] = req.body
	fs.writeFile("./sets.json", JSON.stringify(sets), function(err) {
                if (err) {
                        console.log("Unable to create new set!")
                }
        })
	res.status(200).redirect("/home") 
})


app.post("/viewSets", protectRoute, function(req, res) {

	var a = sets[req.session.userId]

	res.json(a)
})

app.post("/createQuiz", protectRoute, function(req, res) {
	var { number, quizSize } = req.body

	number -= 1

	var title = sets[req.session.userId][number]["set"]
	var set = sets[req.session.userId][number]["data"]
	var setKeys = Object.keys(set)

	var limit = quizSize

	if (limit > setKeys.length) {
		limit = setKeys.length
	}

	var returnJSON = {"setName": title}

	i = 0
	while (i < limit) {
		var value = parseInt(Math.random() * (setKeys.length))
		if (!returnJSON[setKeys[value]]) {
			returnJSON[setKeys[value]] = set[setKeys[value]]
			i++
		}
	}

	res.status(200).json(returnJSON)
})

app.post("/verifyAnswers", protectRoute, function(req, res) {
	if (API_KEY === "") {
		var score = 0

		var { cards, quizSet } = req.body 

		cards.forEach(function(card, index) {
			var userAnswer = card
			var correctAnswer = quizSet.questions[index].answer;
	 
			if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
		  		score++;
		}

		res.status(200).send(score.toString())
	  })
	}
	else {
		var sum = 0

		if (!configuration.apiKey) {
			res.status(400)
		}

		var { cards, quizSet } = req.body

		quizDefinitions = Object.keys(quizSet["questions"])

		var promises = []
		var wrongAnswers = []

		for (var index = 0; index < quizDefinitions.length; index++){
			promises.push(
				runPrompt(
					quizSet["questions"][quizDefinitions[index]]["question"].toString(), 
					quizSet["questions"][quizDefinitions[index]]["answer"].toString(), 
					cards[index].toString()
				).then(function(value) {
					sum += value[0]

					if (value[0] === 0) {
						wrongAnswers.push(value[1])
					}

				})
			)
		}

		Promise.all(promises).then(function() {
			res.status(200).json({"sum": sum.toString(), "wrong": wrongAnswers})
		}).catch(function(err) {
			console.log("Error: ", err)
		})
	}
})

app.get('*', function (req, res) {
    res.status(404).send('Invalid Page!');
  });

app.listen(port, function(){
    console.log("Hi! This server is running on port 3000! To navigate there, go to your browser and type localhost:3000 into the url bar to navigate there!")
})
