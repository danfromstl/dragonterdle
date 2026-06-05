// Pull in a .env file if present
require('dotenv').config()

const express = require('express')
const session = require('express-session')
const AppError = require('./util/AppError')

// set default env vars before loading routes that read process.env at import time
const PORT = process.env['PORT'] || 3000
const SESS_SECRET = process.env.GUESSLE_SESS_SECRET || 'mytimestampbringsalltheboystotheyard-' + Date.now()
const USE_REDIS_SESSIONS = !!process.env.REDIS_URL

if (!process.env.REDIS_URL && process.env.DISABLE_STATS !== 'false') {
    process.env.DISABLE_STATS = 'true'
}

// Require the routes
const game = require('./routes/game')
const stats = require('./routes/stats')
const history = require('./routes/history')
const privacy = require('./routes/privacy')
const admin = require('./routes/admin')


// Express app setup
const app = express()
app.use(express.static('static'))
app.set('view engine', 'pug')
app.use(express.json())
app.use(express.urlencoded({ extended: true }))


// Set up the express session management with Redis
const sessionOptions = {
    secret: SESS_SECRET,
    resave: false,
    name: 'guessle',
    saveUninitialized: false
}

if (USE_REDIS_SESSIONS) {
    const { createClient } = require('redis')
    const RedisStore = require('connect-redis')(session)
    const redisSessionClient = createClient({
        url: process.env.REDIS_URL,
        tls: { rejectUnauthorized: false }
    })
    redisSessionClient.on('error', (err) => {
        console.error('Unable to maintain redis connection for session storage. Stopping server.')
        console.error(err.message)
        process.exit(1)
    })
    sessionOptions.store = new RedisStore({ client: redisSessionClient })
} else {
    console.warn('No REDIS_URL set. Using in-memory sessions and disabling global stats for local development.')
}

app.use(session(sessionOptions))


// Add in our routes
app.use('/stats', stats)
app.use('/history', history)
app.use('/privacy', privacy)
app.use('/admin', admin)
app.use('/', game)  // the game is mounted to the root route, so needs to be last


// Kill any leftover cache connections
app.use(async (req, res, next) => {
    if (req.cacheClient) {
        try {
            await req.cacheClient.quitAsync()
        } catch(err) { /* Don't care because I would just log this, and we log it in the cache util */ }
    }
    next()
})


// 404 catcher, then error catchall
app.use((req, res, next) => {
    next(new AppError('Sorry, but I could not find that page.', 404))
})
app.use(async (err, req, res, next) => {
    if (!err.status || err.status > 499) {
        if (process.env.NODE_ENV === 'development') {
            console.error(err)
        } else {
            console.error(err.message)
        }
    }

    if (req.cacheClient) {
        try {
            await req.cacheClient.quitAsync()
        } catch(err) { /* Don't care because I would just log this, and we log it in the cache util */ }
    }
    
    res.status(err.status || 500)
    res.render('error', {
        page: 'error',
        title: 'Error',
        errorMessage: (err.status === 500) ? 'Sorry, we ran into a problem.' : err.message
    })
})


// here we go...
app.listen(PORT, () => {
    console.info(`Dargonterdle app listening at http://localhost:${PORT}`)
})
