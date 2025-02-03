import express, { Request } from 'express'
import { PrismaClient } from '@prisma/client'

const app = express()
const port = 3000
const prisma = new PrismaClient();

app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})

interface CreateUser {
    name: string;
    email: string
}

app.post("/users", async (req: Request<{}, {}, CreateUser>, res) => {
    const data = req.body;

    const user = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
        },
    })

    res.json(user)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})