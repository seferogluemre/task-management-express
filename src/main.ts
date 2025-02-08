import express, { Request } from 'express'
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { val } from 'cheerio/dist/commonjs/api/attributes';
import { Prisma, PrismaClient, } from '@prisma/client';

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
    profile?: {
        bio?: string;
        gender: "MALE" | "FENALE" | "OTHER",
    }
}

type UpdateUserBody = Partial<CreateUserBody>

interface UpsertProfile {
    bio?: string,
    gender?: "MALE" | "FEMALE" | "OTHER";
}

app.post("/users", async (req: Request<{}, {}, CreateUserBody>, res) => {
    const payload = req.body;
    const profilePayload = payload.profile;

    try {
        const user = await prisma.user.create({
            data: {
                name: payload.name,
                email: payload.email,
                profile: !!profilePayload ? {
                    create: {
                        gender: profilePayload.gender,
                        bio: profilePayload.bio,
                    },
                }
                    : undefined,
            },
            include: {
                profile: !!profilePayload,
            }
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

app.get('/users/:userId', async (req: Request<{ userId: string }, {}, null, { showProfile?: string }>, res) => {
    const userId = +req.params.userId;
    const showProfile = typeof req.query.showProfile !== "undefined";


    if (!userId) {
        res.status(400).json({ message: "Hatalı kullanıcı ID'si" })
        return;
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            profile: showProfile,
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

// Upsert User Profile
app.put('/users/:userId/profile', async (req: Request<{ userId: string }, {}, UpsertProfile>, res) => {
    const userId = +req.params.userId;
    const payload = req.body;

    if (!userId) {
        res.status(400).json({ message: "Hatalı kullanıcı Id'si" })
        return;
    }

    try {
        const profile = await prisma.profile.upsert({
            where: {
                userId: userId,
            },
            create: {
                userId: userId,
                bio: payload.bio,
                gender: payload.gender!,
            },
            update: {
                bio: payload.bio,
                gender: payload.gender,
            }
        })
        res.json(profile)
        return;
    } catch (e) {
        if (e instanceof PrismaClientValidationError) {
            res.status(400).json({ message: "Gönderilen veriler beklenen şemaya uyuşmuyor" })
            return;
        }
        else if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2003") {
                res.status(404).json({ message: "Kullanıcı bulunamadı" })
                return;
            }
        }
    }
    res.status(500).json({ message: "Sunucu hatası" })
})

app.get('/users/:userId/profile', async (req, res) => {
    const userId = +req.params.userId;

    if (!userId) {
        res.status(400).json({ message: "Hatalı kullanıcı Id'si" })
        return;
    }

    const profile = await prisma.profile.findUnique({
        where: {
            userId: userId,
        }
    })

    if (!profile) {
        res.status(404).json({ message: "Profil bulunamadı" })
        return;
    } else {
        res.json(profile)
    }

    res.status(500).json({ message: "Sunucu Hatası" })

})
// Show All users
app.get('/users', async (req: Request<{}, {}, UpdateUserBody>, res) => {
    const showProfile = typeof req.query.showProfile !== "undefined";

    const users = await prisma.user.findMany({ include: { profile: showProfile } });

    res.json(users)
})

const userUpdateWhitelistField = ["name", "email"] as const;

app.patch('/users/:userId', async (req: Request<{ userId: string }, {}, UpdateUserBody>, res) => {
    const userId = +req.params.userId;
    const payload = req.body;
    const profilePayload = payload.profile;


    const whitelistedPayload: UpdateUserBody = {};

    userUpdateWhitelistField.forEach(fieldName => {
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
            data: {
                ...whitelistedPayload, profile:
                    profilePayload ? {
                        upsert: {
                            where: {
                                userId: userId,
                            },
                            create: {
                                gender: profilePayload?.gender,
                                bio: profilePayload?.bio,
                            },
                            update: {
                                gender: profilePayload?.gender,
                                bio: profilePayload?.bio,
                            }
                        }
                    } : undefined,
            },
            include: { profile: !!profilePayload }
        })
        res.json(updatedUser)
        return;
    } catch (e) {
        console.log(e)
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
// Tasks CRUD ROUTES ---------
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

// Show Task
app.get('/tasks/:taskId', async (req, res) => {
    const taskId = +req.params.taskId;

    if (!taskId) {
        res.status(400).json({ message: "Hatalı Görev ID'si" })
        return;
    }

    const task = await prisma.task.findUnique({
        where: {
            id: taskId,
        }
    })

    if (!task) {
        res.status(404).json({ message: "Görev bulunamadı" })
        return;
    }
    else {
        res.json(task)
    }
    res.status(500).json({ message: "Sunucu Hatası" })
})

// Index Show tasks
app.get('/tasks', async (req, res) => {
    const tasks = await prisma.task.findMany();
    res.json(tasks)
})

interface CreateTaskBody {
    userId: number;
    title: string;
    details?: string;
}
type UpdateTaskBody = Partial<CreateTaskBody>

// Update task
const taskUpdateWhitelistField = ["userId", "title", "details"] as const;
app.patch('/tasks/:taskId', async (req: Request<{ taskId: string }, {}, UpdateTaskBody>, res) => {
    const taskId = +req.params.taskId;
    const payload = req.body;

    const whitelistedPayload: UpdateTaskBody = {};

    taskUpdateWhitelistField.forEach(fieldName => {
        const value = payload[fieldName]
        if (value) {
            (whitelistedPayload[fieldName] as typeof value) = value;
        }
    })

    if (!taskId) {
        res.status(404).json({ message: "Hatalı Görev ID'si" })
        return;
    }

    try {
        const updatedTask = await prisma.task.update({
            where: {
                id: taskId,
            },
            data: whitelistedPayload,
        })
        res.json(updatedTask)
        return;
    } catch (e) {
        if (e instanceof PrismaClientValidationError) {
            res.status(400).json({ message: "Gönderilen veriler beklenen veri şemasına uymuyor." })
            return;
        }
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2025") {
                res.status(404).json({ message: "Görev bulunamadı" })
                return;
            }
            else if (e.code === "P2003") {
                res.status(404).json({ message: "Kullanıcı bulunamadı" })
                return;
            }
        }

    }

    res.status(500).json({ message: "Sunucu hatası" })
})
// Delete task
app.delete('/tasks/:taskId'), async (req, res) => {
    const taskId = +req.params.taskId;
    if (!taskId) {
        res.status(404).json({ message: "Hatalı Görev ID'si" })
        return;
    }
    try {
        const deletedTask = await prisma.task.delete({
            where: {
                id: taskId
            }
        })
        res.json(deletedTask);
        return;
    } catch (e) {
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2025") {
                res.status(404).json({ message: "Görev bulunamadı" })
                return;
            }
        }
    }
    res.status(500).json({ message: "Sunucu hatası" })
}

interface CreateTagBody {
    name: string;
}

// Create Tag
app.post('/tags'), async (req: Request<{}, {}, CreateTagBody>, res) => {
    const payload = req.body;

    try {
        const tag = await prisma.tag.create({
            data: {
                name: payload.name,
            },
        })
        res.json(tag)

        return;
    } catch (e) {

        if (e instanceof PrismaClientValidationError) {
            res.status(400).json({ message: "Gönderilen veriler beklenen veri şemasına uymuyor." })
            return;
        }

    }

    res.status(500).json({ message: "Sunucu Hatası" });
}

// Show tag
app.get('/tags/:tagId'), async (req: Request<{ tagId: string }, {}, null>, res) => {
    const tagId = +req.params.tagId;

    if (!tagId) {
        res.status(400).json({ message: "Hatalı Etiket ID'si" })
        return;
    }

    const tag = await prisma.task.findUnique({
        where: {
            id: tagId,
        }
    })

    if (!tagId) {
        res.status(404).json({ message: "Etiket bulunamadı" })
        return;
    }
    else {
        res.json(tag)
    }
    res.status(500).json({ message: "Sunucu Hatası" })

}

// Index Show tags
app.get('/tags', async (req, res) => {
    const tags = await prisma.tag.findMany();
    res.json(tags)
})


interface UpdateTagBody {
    name: string;
}

// Update tag 
const tagUpdateWhitelistField = ["name"] as const;
app.patch('/tags/:tagId'), async (req: Request<{ tagId: string }, {}, UpdateTagBody>, res) => {
    const tagId = +req.params.tagId;
    const payload = req.body;

    if (!tagId) {
        res.status(404).json({ message: "Hatalı Etiket ID'si" })
        return;
    }

    const whitelistedPayload: UpdateTagBody = {};

    tagUpdateWhitelistField.forEach(fieldName => {
        const value = payload[fieldName]
        if (value) {
            (whitelistedPayload[fieldName] as typeof value) = value;
        }
    })

    try {
        const updatedTag = await prisma.tag.update({
            where: {
                id: tagId,
            },
            data: whitelistedPayload,
        })
        res.json(updatedTag)
        return;

    } catch (e) {
        if (e instanceof PrismaClientValidationError) {
            res.status(400).json({ message: "Gönderilen veriler beklenen veri şemasına uymuyor." })
            return;
        }
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2025") {
                res.status(404).json({ message: "Etiket bulunamadı" })
                return;
            }
        }
    }


}

// Tag delete
app.delete('/tags/:tagId'), async (req: Request<{ tagId: string }, {}, null>, res) => {
    const tagId = +req.params.tagId;
    if (!tagId) {
        res.status(404).json({ message: "Hatalı Etiket ID'si" })
        return;
    }
    try {
        const deletedTag = await prisma.tag.delete({
            where: {
                id: tagId
            }
        })
        res.json(deletedTag);
        return;
    } catch (e) {
        if (e instanceof PrismaClientKnownRequestError) {
            if (e.code === "P2025") {
                res.status(404).json({ message: "Etiket bulunamadı" })
                return;
            }
        }
    }
    res.status(500).json({ message: "Sunucu hatası" })
}



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})