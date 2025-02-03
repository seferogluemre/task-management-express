import express, { Request } from 'express'
import { PrismaClient } from '@prisma/client'

const app = express()
const port = 3000
const prisma = new PrismaClient();

app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.post("/users", (req: Request<{}, {}, { name: string; email: string }>, res) => {
    const data = req.body;
    console.log(data)


    res.send("Kullanıcı oluşturuldu")
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})