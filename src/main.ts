import express, { Request } from 'express'
import { PrismaClient } from '@prisma/client'
import { error } from 'console';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const app = express()
const port = 3000
const prisma = new PrismaClient();

app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})

interface CreateUserBody {
    name: string;
    email: string;
}
type UpdateUserBody = Partial<CreateUserBody>

app.post("/users", async (req: Request<{}, {}, CreateUserBody>, res) => {

    const data = req.body;

    try {
        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
            },
        })
        res.json(user)

    } catch (e) {
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2002") {
                res.status(409).json({ message: "Bu e-posta adresi sistemde zaten kayıtlı" })
            }
        }
    }
})

app.get('/users/:userId', async (req, res) => {
    const userId = +req.params.userId;
    if (!userId) {
        res.status(400).json({ message: "Hatalı kullanıcı ID'si" })
        return;
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        }
    })
    if (!user) {
        res.status(404).json({ message: "Kullanıcı bulunamadı" })
        return;
    } else {
        res.json(user)
    }

})

app.get('/users', async (req, res) => {
    const users = await prisma.user.findMany();
    res.json(users)
})

const whitelistField = ["name", "email"] as const;

app.patch('/users/:userId', async (req: Request<{ userId: string }, {}, UpdateUserBody>, res) => {
    const userId = +req.params.userId;
    const updatePayload = req.body;

    const whitelistedPayload: UpdateUserBody = {};

    whitelistField.forEach(fieldName => {
        if (updatePayload[fieldName]) {
            whitelistedPayload[fieldName] = updatePayload[fieldName]
        }
    })

    if (!userId) {
        res.status(404).json({ message: "Hatalı kullanıcı ID'si" })
        return;
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: whitelistedPayload,
    })
    res.json(updatedUser)
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})