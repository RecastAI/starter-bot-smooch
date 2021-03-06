// MODULES IMPORT
import express from 'express'
import bodyParser from 'body-parser'
import request from 'superagent'
import config from '../config'
import jwt from 'jsonwebtoken'
import recastai from 'recastai'

// POST requests Listening
const app = express()
const client = new recastai(config.recast.token, config.recast.language)
const header = {
  alg: 'HS256',
  typ: 'JWT',
  kid: config.smooch.keyId,
}

const payload = {
  scope: 'app',
}

const jwtToken = jwt.sign(JSON.stringify(payload), config.smooch.secret, { header })

app.use(bodyParser.urlencoded({
  extended: true,
}))

app.use(bodyParser.json())

app.post('/', (req, res) => {
  handleMessage(req.body)
  res.send('OK')
})

// Message handling
const handleMessage = (message) => {
  const sender = message.messages[0].authorId
  const text = message.messages[0].text

  // CALL TO RECAST.AI: 'sender' is a unique ID of your conversation with the user
  // The conversationToken is what lets Recast.AI identify your conversation.
  // As 'sender' is what identifies your conversation with the channel used, you can use it as conversationToken.
  client.request.converseText(text, { conversationToken: sender })
  .then((res) => {
    const replies = res.replies
    const action = res.action

    if (!replies.length) {
      sendMessage('I didn\'t understand... Sorry :(', sender)
      return
    }

    if (action && action.done) {
      // Use external services: use res.memory('notion') if you got a notion from this action
    }

    replies.forEach(reply => sendMessage(reply, sender))
  })
  .catch(() => {
    sendMessage('I need some sleep right now... Talk to me later!', sender)
  })
}

// Message sending
const sendMessage = (text, recipient) => {
  return new Promise((resolve) => {
    const message = {
      role: 'appMaker',
      text,
    }
    request.post(`https://api.smooch.io/v1/appusers/${recipient}/messages`)
    .send(message)
    .set('content-type', 'application/json')
    .set('authorization', `Bearer ${jwtToken}`)
    .end(() => {
      return resolve()
    })
  })
}

app.listen(config.port)
