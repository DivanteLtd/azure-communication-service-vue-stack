import express from "express"
import { issueAccessToken } from './issue-access-token.js'
import cors from 'cors'
import { encrypt , decrypt } from './crypto.js'
import bodyParser from 'body-parser'

const app = express()
app.use(cors());
app.use(bodyParser.json())

const port = 8000

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})

app.get('/', (req, res) => {
    res.json({"message":"Ok"})
})

app.get("/issue_access_token", async (req, res, next) => {
    const result = await issueAccessToken().catch((error) => {
        res.json(error)
      })
    const data = {"encrypted_auth": encrypt(JSON.stringify(result)), "user_id": result.user_id}
    res.json(data)
});

app.post('/get_access_token', async function(req, res){
    const decrypted = JSON.parse(decrypt(req.body))
    res.send(decrypted.token)
});

app.use(function(req, res){
    res.status(404);
});




