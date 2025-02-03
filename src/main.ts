import express, { Request } from 'express'
import { PrismaClient } from '@prisma/client'
import { error } from 'console';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';

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

    const payload = req.body;

    try {
        const user = await prisma.user.create({
            data: {
                name: payload.name,
                email: payload.email,
            },
        })
        res.json(user)
        return;

    } catch (e) {
        if (e instanceof PrismaClientValidationError) {
            res.status(400).json({ message: "Gönderilen veriler beklenen veri şemasına uymuyor." })
            return;
        }
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2002") {
                res.status(409).json({ message: "Bu e-posta  sistemde zaten kayıtlı" })
            }
        }
    }
    res.status(500).json({ message: "Sunucu hatası" })

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

    res.status(500).json({ message: "Sunucu Hatası" })
})

app.get('/users', async (req, res) => {
    const users = await prisma.user.findMany();
    res.json(users)
})

const whitelistField = ["name", "email"] as const;

app.patch('/users/:userId', async (req: Request<{ userId: string }, {}, UpdateUserBody>, res) => {
    const userId = +req.params.userId;
    const payload = req.body;

    const whitelistedPayload: UpdateUserBody = {};

    whitelistField.forEach(fieldName => {
        if (payload[fieldName]) {
            whitelistedPayload[fieldName] = payload[fieldName]
        }
    })
    if (!userId) {
        res.status(404).json({ message: "Hatalı kullanıcı ID'si" })
        return;
    }

    try {
        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: whitelistedPayload,
        })
        res.json(updatedUser)
        return;
    } catch (e) {
        if (e instanceof PrismaClientValidationError) {
            res.status(400).json({ message: "Gönderilen veriler beklenen veri şemasına uymuyor." })
            return;
        }
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2025") {
                res.status(404).json({ message: "Kullanıcı bulunamadı" })
                return;
            }
            else if (e.code === "P2002") {
                res.status(409).json({ message: "Bu e-posta adresi sistemde zaten kayıtlı" })
                return;
            }
        }
    }

    res.status(500).json({ message: "Sunucu hatası" })
})

app.delete('/users/:userId', async (req, res) => {
    const userId = +req.params.userId;

    if (!userId) {
        res.status(404).json({ message: "Hatalı kullanıcı ID'si" })
        return;
    }
    try {
        const deletedUser = await prisma.user.delete({
            where: {
                id: userId
            }
        })
        res.json(deletedUser);
        return;

    } catch (e) {
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2025") {
                res.status(404).json({ message: "Kullanıcı bulunamadı" })
                return;
            }
        }
    }

    res.status(500).json({ message: "Sunucu hatası" })

})

interface CreateTaskBody {
    userId: number;
    title: string;
    details?: string;
}

app.post("/tasks", async (req: Request<{}, {}, CreateTaskBody>, res) => {
    const payload = req.body;
    const userId = payload.userId;

    if (typeof userId !== "number") {
        res.status(400).json({ message: "Hatalı Kullanıcı Id'si" })
        return;
    }
    try {
        const task = await prisma.task.create({
            data: {
                userId,
                title: payload.title,
                details: payload.details,
            },
        })
        res.json(task)
        return;
    } catch (e) {
        if (e instanceof PrismaClientValidationError) {
            res.status(400).json({ message: "Gönderilen veriler beklenen veri şemasına uymuyor." })
            return;
        }
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2003") {
                res.status(404).json({ message: "Kullanıcı bulunamadı" })
                return;
            }
        }
    }
    res.status(500).json({ message: "Sunucu hatası" })
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})