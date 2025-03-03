import express, { Request } from 'express'
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { Gender, Prisma, PrismaClient, } from '@prisma/client';
import { fakerTR as faker } from '@faker-js/faker'

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
interface ListUsersQuery {
    name?: string;
    showProfile?: string;
    limit?: string;
    page?: string;
}

app.get('/users', async (req: Request<{}, {}, ListUsersQuery>, res) => {

    const showProfile = typeof req.query.showProfile !== "undefined";
    const limit = Math.min(req.query.limit ? Number(req.query.limit) : 20, 20);
    const page = Math.max(req.query.page ? Number(req.query.page) : 1, 1);
    const skip = (page - 1) * limit;

    const name = req.query.name;


    const usersCount = await prisma.user.count();

    const users = await prisma.user.findMany(
        {
            where: {
                name: {
                    contains: name,
                    mode: "insensitive"
                },
                email: {
                    endsWith: "@gmail.com",
                }
            },
            take: limit,
            skip: skip,
            include: {
                profile: showProfile
            }
        }
    );

    const totalPages = Math.ceil(usersCount / limit)

    const response = {
        data: users,
        meta: {
            count: usersCount,
            totalPages: totalPages,
            currentPage: page,
            limit: limit,
        }
    }

    res.json(response)
})


// Update User
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
    parentTaskId?: number;
}
// Tasks CRUD ROUTES ---------
app.post("/tasks", async (req: Request<{}, {}, CreateTaskBody>, res) => {
    const payload = req.body;
    const userId = payload.userId;
    const parentTaskId = payload.parentTaskId;

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
                parentTaskId
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
        },
        include: {
            parentTask: {
                include: {
                    parentTask: true,
                }
            },
            childTasks: true,
        }
    })

    res.json(task)

    if (!task) {
        res.status(404).json({ message: "Görev bulunamadı" })
        return;
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
    parentTaskId?: number;
}
type UpdateTaskBody = Partial<CreateTaskBody>

// Update task
const taskUpdateWhitelistField = ["userId", "title", "details", "parentTaskId"] as const;
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

    if (payload.parentTaskId) {
        let currentParentId: null | number = payload.parentTaskId;

        while (currentParentId) {

            if (taskId === currentParentId) {
                res.status(400).json({ message: "Döngüsel üst görev ilişkisi kurulamaz" })
                return;
            }

            const parentTask: {
                parentTaskId: number | null,
            } | null = await prisma.task.findUnique({
                where: {
                    id: currentParentId as number,
                },
                select: {
                    parentTaskId: true,
                }
            })

            if (!parentTask) {
                res.status(400).json({ message: "Üst görev bulunamadı" })
                return;
            }

            currentParentId = parentTask?.parentTaskId
        }
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
                if (e.meta!.fieldName === "Task_userId_fkey (index)") {
                    res.status(404).json({ message: "kullanıcı bulunamadı" })
                    return;
                }
                if (e.meta!.fieldName === "Task_parentTaskId_fkey (index)") {
                    res.status(404).json({ message: "Görev bulunamadı" })
                    return;
                }
            }
        }
    }

    res.status(500).json({ message: "Sunucu hatası" })
})
// Delete task
app.delete('/tasks/:taskId'), async (req: Request<{ taskId: string }, {}, null>, res: Response) => {
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

app.post('/tags', async (req: Request<{}, {}, CreateTagBody>, res) => {
    const payload = req.body;

    try {
        const tag = await prisma.tag.create({
            data: {
                name: payload.name,
            },
        });

        res.json(tag);
        return;
    } catch (e) {
        if (e instanceof PrismaClientValidationError) {
            res.status(400).json({ message: "Gönderilen veriler beklenen veri şemasına uymuyor." });
            return;
        }
    }

    res.status(500).json({ message: "Sunucu Hatası" });
})

// Show tag
app.get('/tags/:tagId', async (req: Request<{ tagId: string }, {}, null>, res) => {
    const tagId = +req.params.tagId;

    if (!tagId) {
        res.status(400).json({ message: "Hatalı Etiket ID'si" })
        return;
    }

    const tag = await prisma.tag.findUnique({
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

})


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
app.patch('/tags/:tagId', async (req: Request<{ tagId: string }, {}, UpdateTagBody>, res) => {
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
    res.status(500).json({ message: "Sunucu hatası" })
})
// Tag delete
app.delete('/tags/:tagId', async (req: Request<{ tagId: string }, {}, null>, res) => {
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
})

interface ChangeTaskTags {
    tags: { id: number, note?: string }[],
}
// Task Tags create
app.post('/tasks/:taskId/tags', async (req: Request<{ taskId: string }, {}, ChangeTaskTags>, res) => {
    const taskId = +req.params.taskId;
    const tagsPayload = req.body.tags;


    if (!taskId) {
        res.status(400).json({ message: "Hatalı Görev ID'si" })
        return;
    }

    if (tagsPayload === undefined) {
        res.status(404).json({ message: "Etiket ID'leri listesi belirtilmedi" })
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

    const tagIds = tagsPayload.map((tagPayload) => tagPayload.id)

    const tags = await prisma.tag.findMany({
        where: {
            id: {
                in: tagIds
            }
        }
    })

    const foundTagIds = tags.map(tag => tag.id)
    const difference = tagIds.filter((tag) => !foundTagIds.includes(tag))

    if (difference.length > 0) {
        const differenceIdsString = difference.join(", ");

        res.status(400).json({ message: "Belirtilen etiketler sistemde bulunamadı: " + differenceIdsString })
        return;
    }


    await prisma.task.update({
        where: {
            id: taskId,
        },
        data: {
            tags: {
                deleteMany: [],
            }
        },
        include: {
            tags: true,
        }
    });


    const taskResponse = await prisma.task.update({
        where: {
            id: taskId,
        },
        data: {
            tags: {
                createMany: {
                    data: tagsPayload.map((tagPayload) => ({
                        tagId: tagPayload.id,
                        note: tagPayload.note
                    }))
                }
            }
        },
        include: { tags: true }

    })
    res.status(201).json(taskResponse)
})

app.post('/users/generate', async (req, res) => {
    const count = req.body.count;
    const users = [];

    for (let i = 0; i < count; i++) {
        const randomFirstName = faker.person.firstName();
        const randomLastName = faker.person.lastName();

        const randomEmail = faker.internet.email({
            firstName: randomFirstName,
            lastName: randomLastName,
        });


        const randomName = randomFirstName + " " + randomLastName;

        const profilePayload = {
            bio: faker.lorem.lines(),
            gender: faker.person.sexType().toUpperCase() as Gender,
        }

        const user = await prisma.user.create({
            data: {
                name: randomName,
                email: randomEmail,
                profile: {
                    create: {
                        bio: profilePayload.bio,
                        gender: profilePayload.gender,
                    }
                }
            },
            include: {
                profile: true,
            }
        })
        users.push(user)
    }
    res.json(users)
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
