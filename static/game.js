
//------------------ Cache some DOM elements -------------------- //
const gameBoard = document.querySelector('.game-board')
const pastGuesses = document.querySelector('.past-guesses')
const futureGuesses = document.querySelector('.future-guesses')
const submitGuessEl = document.querySelector('#submit-guess')
const guessInfo = document.querySelector('#guess-info')
const gameHelp = document.querySelector('.game-help')
gameHelp.style.display = 'none'
const gameOptionsEl = document.querySelector('.game-options')
gameOptionsEl.style.display = 'none'
const gameStats = document.querySelector('.stats')

// These will be set later in the startup actions (very bottom)
let inputs = []
let dictionary = null


//------------------ Check for options -------------------- //
const OPTIONS_KEY = 'guessle-options'
const OPTIONS_VERSION = 2
const RESERVED_GUESS_ROWS = 6
const DEFAULT_COLORS = (window.guessleTheme && window.guessleTheme.DEFAULT_COLORS) || {
    present: '#eec4cc',
    correct: '#337f37'
}
const LEGACY_DEFAULT_COLORS = {
    present: '#cccc55',
    correct: '#99cc99'
}
const defaultOptions = {
    version: OPTIONS_VERSION,
    dark: true,
    depth: 1,
    duplicateLetters: true,
    wordLength: 6,
    accessibleMarkers: false,
    openers: {},
    colors: { ...DEFAULT_COLORS }
}
let options = localStorage.getItem(OPTIONS_KEY)
if (options) {
    try {
        options = normalizeOptions(JSON.parse(options))
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
    } catch(err) {
        console.warn('Bad options:', err.message)
        options = normalizeOptions()
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
    }
} else {
    options = normalizeOptions()
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
}
initOptions(options)


//------------------ Check for game history -------------------- //
const HISTORY_KEY = 'guessle-history'
let gameHistory = localStorage.getItem(HISTORY_KEY)
if (gameHistory) {
    try {
        gameHistory = JSON.parse(gameHistory)
        if (!Array.isArray(gameHistory)) {
            throw new Error('Game history is not an array, so unfortunately it is getting reset: ' + JSON.stringify(gameHistory))
        }
    } catch(err) {
        console.warn('Bad history:', err.message)
        gameHistory = []
        localStorage.setItem(HISTORY_KEY, '[]')
    }
} else {
    gameHistory = []
    localStorage.setItem(HISTORY_KEY, '[]')
}
updateStats()


//------------------ Set up game listeners -------------------- //

const letterHints = {}
Array.from(document.querySelectorAll('.all-letters .letter')).forEach((letterEl) => {
    letterHints[letterEl.innerText] = letterEl
    letterEl.addEventListener('click', (e) => { handleKeyboardEntry(e.target.innerText) })
})

document.body.addEventListener('keydown', (e) => {
    if (e.target.nodeName !== 'INPUT') {
        if (/^Key([A-Z]$)/.test(e.code)) {
            handleKeyboardEntry(e.key.toLocaleLowerCase())
        } else if (e.code === 'Backspace') {
            handleKeyboardEntry('del')
        } else if (e.code === 'Enter') {
            const guess = inputs.map((el) => el.innerText.trim().toLowerCase()).filter((l) => !!l).join('')
            submitGuess(guess)
        } else if (e.code === 'Slash') {  // "?" is Shift-Slash, but we'll just capture either
            toggleHelp()
        }
    }
})

if (submitGuessEl) {
    submitGuessEl.addEventListener('click', () => {
        const guess = inputs.map((el) => el.innerText.trim().toLowerCase()).filter((l) => !!l).join('')
        submitGuess(guess)
    })
}

document.querySelector('.give-up').addEventListener('click', async (e) => {
    e.preventDefault()
    giveUp()
    return false
})

document.querySelector('.help').addEventListener('click', toggleHelp)
document.querySelector('.close-help').addEventListener('click', toggleHelp)
document.querySelector('.options').addEventListener('click', toggleOptions)
document.querySelector('.close-options').addEventListener('click', () => {
    toggleOptions()
    sendServerOptions(options)
})


document.querySelector('.clear-history').addEventListener('click', (e) => {
    e.preventDefault()
    if (window.confirm('Are you sure you want to clear your game history and reset your stats?')) {
        gameHistory = []
        localStorage.setItem(HISTORY_KEY, '[]')
        updateStats()
    }
})

gameOptionsEl.querySelector('#dark-mode').addEventListener('change', toggleDarkMode)
gameOptionsEl.querySelector('#opener-5').addEventListener('blur', setDefaultOpener)
gameOptionsEl.querySelector('#opener-6').addEventListener('blur', setDefaultOpener)
Array.from(gameOptionsEl.querySelectorAll('[name="word-length"]')).forEach((el) => {
    el.addEventListener('click', () => { setWordLength(Number(el.value)) })
})
Array.from(gameOptionsEl.querySelectorAll('[name="word-depth"]')).forEach((el) => {
    el.addEventListener('click', () => { setWordDepth(Number(el.value)) })
})
gameOptionsEl.querySelector('#dupe-letters').addEventListener('change', toggleDuplicateLetters)
gameOptionsEl.querySelector('#accessible-markers').addEventListener('change', toggleAccessibleMarkers)
Array.from(gameOptionsEl.querySelectorAll('.result-color')).forEach((el) => {
    el.addEventListener('input', setResultColor)
})
gameOptionsEl.querySelector('.reset-colors').addEventListener('click', resetResultColors)


//------------------ Main event handlers -------------------- //

function toggleHelp() {
    gameHelp.style.display = (gameHelp.style.display === 'none') ? 'block' : 'none'
}

function toggleOptions() {
    gameOptionsEl.style.display = (gameOptionsEl.style.display === 'none') ? 'block' : 'none'
}

function toggleDarkMode() {
    options.dark = !options.dark
    if (options.dark) {
        document.body.classList.add('dark-mode')
    } else {
        document.body.classList.remove('dark-mode')
    }
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
}

function setDefaultOpener(e) {
    options.openers[e.target.id.split('-')[1]] = e.target.value
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
}

function setWordLength(length) {
    options.wordLength = (Number(length)) ? Number(length) : options.length
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
    sendServerOptions(options)
}

function setWordDepth(depth) {
    options.depth = (Number(depth)) ? Number(depth) : options.depth
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
    sendServerOptions(options)
}

function toggleDuplicateLetters() {
    options.duplicateLetters = !options.duplicateLetters
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
    sendServerOptions(options)
}

function toggleAccessibleMarkers() {
    options.accessibleMarkers = !options.accessibleMarkers
    if (options.accessibleMarkers) {
        document.body.classList.add('accessible-markers')
    } else {
        document.body.classList.remove('accessible-markers')
    }
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
}

function setResultColor(e) {
    options.colors = {
        ...DEFAULT_COLORS,
        ...(options.colors || {}),
        [e.target.name]: e.target.value
    }
    options.colors = applyColorOptions(options.colors)
    updateResultColorInputs(options.colors)
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
}

function resetResultColors(e) {
    e.preventDefault()
    options.colors = { ...DEFAULT_COLORS }
    options.colors = applyColorOptions(options.colors)
    updateResultColorInputs(options.colors)
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
}

function applyColorOptions(colors) {
    if (window.guessleTheme && typeof window.guessleTheme.apply === 'function') {
        return window.guessleTheme.apply(colors)
    }

    const normalized = { ...DEFAULT_COLORS, ...(colors || {}) }
    document.documentElement.style.setProperty('--guessle-present-color', normalized.present)
    document.documentElement.style.setProperty('--guessle-correct-color', normalized.correct)
    return normalized
}

function updateResultColorInputs(colors) {
    const normalized = { ...DEFAULT_COLORS, ...(colors || {}) }
    gameOptionsEl.querySelector('#present-color').value = normalized.present
    gameOptionsEl.querySelector('#correct-color').value = normalized.correct
}


async function sendServerOptions(opts) {
    const resp = await fetch(`/options?length=${opts.wordLength}&depth=${opts.depth}&dupeLetters=${opts.duplicateLetters.toString()}`)
    if (resp.status !== 200) {
        console.warn('Unable to set options on server:', resp.status)
    }
}

function handleKeyboardEntry(letter) {
    if (letter === 'del') {
        let lastEl = null
        inputs.forEach((el) => {
            if (el.innerText) { lastEl = el }
        })
        if (lastEl) { lastEl.innerText = '' }
    } else {
        for (let i=0; i<inputs.length; ++i) {
            if (!inputs[i].innerText) {
                inputs[i].innerText = letter
                break
            }
        }
    }
}

async function giveUp() {
    if (window.confirm('Are you sure you want to give up?')) {
        const resp = await fetch('/answer')
        const surrender = document.querySelector('.surrender-info')
        if (resp.status === 200) {
            const result = await resp.json()

            addHistoryEntry(result.guesses, result.solution)
            updateStats()

            const answer = surrender.querySelector('.answer')
            answer.innerText = result.solution
            answer.setAttribute('href', answer.getAttribute('href') + result.solution)
        } else {
            surrender.innerHTML = `You'll get it next time!<br>Sorry, but I wasn't able to retrieve the answer from the server.`
        }
        surrender.classList.remove('hidden')
        document.querySelector('.give-up').classList.add('hidden')
        document.querySelector('.new-word').classList.remove('hidden')
        document.querySelector('.guess-inputs').classList.add('hidden')
        if (futureGuesses) { futureGuesses.classList.add('hidden') }
        submitGuessEl.classList.add('hidden')
    }
}

async function submitGuess(guess) {
    if (guess.length !== inputs.length || !/^[a-z]+$/.test(guess)) {
        return setMessage(`Please enter a ${inputs.length}-letter word.`)
    }
    if (dictionary && dictionary[guess.length].length && !dictionary[guess.length].includes(guess)) {
        return setMessage('Sorry, but I don\'t know that word.')
    }

    clearMessage()
    const resp = await fetch(`/guess?w=${guess}`)
    const result = await resp.json()
    if (resp.status === 200) {
        addGuess(result.guess)
        showLetterHints(result.guesses)
        inputs.forEach((el) => { el.innerText = '' })
        if (result.solved) {
            addHistoryEntry(result.guesses)
            updateStats()

            const solution = document.querySelector('.solution-info')
            solution.innerHTML = `Congratulations! You solved this Dargonterdle in
                <strong>${result.guesses.length}</strong> guess${(result.guesses.length === 1) ? '' : 'es'}!
                <br><br>
                The word was <a target='_blank' href='https://www.merriam-webster.com/dictionary/${guess}'>${guess}</a>.`
            solution.classList.remove('hidden')
            document.querySelector('.guess-inputs').classList.add('hidden')
            if (futureGuesses) { futureGuesses.classList.add('hidden') }
            submitGuessEl.classList.add('hidden')
            document.querySelector('.give-up').classList.add('hidden')
            document.querySelector('.new-word').classList.remove('hidden')
        } else {
            renderFutureGuesses(result.guesses.length, result.guess.length)
        }
        document.querySelector('.actions').scrollIntoView()

    } else {
        setMessage(result.message)
    }
}

function addGuess(guess) {
    pastGuesses.innerHTML += [
        `<aside class='guess'>`,
        ...guess.map((letter) => {
            return `<span class='letter check-${letter.check}'>${letter.letter}</span>`
        }),
        '</aside>'
    ].join('')
}

function buildGuessInputs(wordLength) {
    const guessEl = document.querySelector('.guess-inputs .guess')
    if (!guessEl) { return }

    const letters = []
    for (let i=0; i<wordLength; ++i) {
        letters.push(`<span class="input letter" id="guess-${i}"></span>`)
    }

    guessEl.innerHTML = letters.join('')
    inputs = Array.from(document.querySelectorAll('.input.letter'))
}

function renderFutureGuesses(completedGuessCount, wordLength) {
    if (!futureGuesses) { return }

    const hasActiveGuess = !document.querySelector('.guess-inputs').classList.contains('hidden')
    const rowCount = Math.max(0, RESERVED_GUESS_ROWS - completedGuessCount - (hasActiveGuess ? 1 : 0))
    const emptyLetters = Array.from({ length: wordLength }, () => '<span class="letter empty-letter"></span>').join('')
    futureGuesses.innerHTML = Array.from({ length: rowCount }, () => `<aside class="guess empty-guess">${emptyLetters}</aside>`).join('')
    futureGuesses.classList.remove('hidden')
}

function showLetterHints(guesses) {
    if (!Object.keys(letterHints).length) { return }
    guesses.forEach((guess) => {
        guess.forEach((guessLetter) => {
            letterHints[guessLetter.letter].classList.add(`check-${guessLetter.check}`)
        })
    })
}

function updateStats() {
    const stats = { played: 0, won: 0, quit: 0, guessCounts: [] }

    gameHistory.forEach((game) => {
        stats.played++
        const guesses = game.split('|')[0].split('>')
        stats.guessCounts.push(guesses.length)
        if (/^[2]+$/.test(guesses.pop())) { stats.won++ } else { stats.quit++ }
    })

    gameStats.querySelector('.play-count').innerText = stats.played
    gameStats.querySelector('.win-count').innerText = stats.won
    gameStats.querySelector('.quit-count').innerText = stats.quit
    if (stats.played > 0) {
        gameStats.querySelector('.win-percent').innerText = Math.round((stats.won / stats.played) * 100)
        gameStats.querySelector('.quit-percent').innerText = Math.round((stats.quit / stats.played) * 100)
        gameStats.querySelector('.guess-avg').innerText = Math.round(((stats.guessCounts.reduce((t, v) => t+v, 0)) / stats.guessCounts.length) * 10) / 10
    } else {
        gameStats.querySelector('.win-percent').innerText = 0
        gameStats.querySelector('.quit-percent').innerText = 0
        gameStats.querySelector('.guess-avg').innerText = 0
    }
}

function addHistoryEntry(guesses, solution) {
    const answer = (solution) ? solution : guesses[guesses.length-1].map((gl) => gl.letter).join('')
    const guessChecks = guesses.map((guess) => {
        return guess.map((gl) => gl.check).join('')
    })

    gameHistory.push(`${guessChecks.join('>')}|${answer}`)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(gameHistory))
}

function normalizeOptions(savedOptions = {}) {
    const merged = {
        ...defaultOptions,
        ...savedOptions
    }
    merged.openers = {
        ...defaultOptions.openers,
        ...(savedOptions.openers || {})
    }
    merged.colors = {
        ...DEFAULT_COLORS,
        ...(savedOptions.colors || {})
    }
    Object.keys(LEGACY_DEFAULT_COLORS).forEach((key) => {
        if ((merged.colors[key] || '').toLowerCase() === LEGACY_DEFAULT_COLORS[key]) {
            merged.colors[key] = DEFAULT_COLORS[key]
        }
    })
    if (savedOptions.version !== OPTIONS_VERSION) {
        if (savedOptions.dark === false || typeof(savedOptions.dark) !== 'boolean') {
            merged.dark = defaultOptions.dark
        }
        if (savedOptions.depth === 2 || !savedOptions.depth) {
            merged.depth = defaultOptions.depth
        }
        if (savedOptions.wordLength === 5 || !savedOptions.wordLength) {
            merged.wordLength = defaultOptions.wordLength
        }
    }
    merged.version = OPTIONS_VERSION
    return merged
}

function initOptions(options) {
    options.colors = applyColorOptions(options.colors)
    updateResultColorInputs(options.colors)

    if (options.dark) {
        document.body.classList.add('dark-mode')
        gameOptionsEl.querySelector('#dark-mode').setAttribute('checked', 'checked')
    }
    gameOptionsEl.querySelector('#opener-5').value = options.openers['5'] || ''
    gameOptionsEl.querySelector('#opener-6').value = options.openers['6'] || ''
    gameOptionsEl.querySelector(`.word-length[value="${options.wordLength}"]`).setAttribute('checked', 'checked')
    gameOptionsEl.querySelector(`.word-depth[value="${options.depth}"]`).setAttribute('checked', 'checked')
    if (options.duplicateLetters) {
        gameOptionsEl.querySelector('#dupe-letters').setAttribute('checked', 'checked')
    }
    if (options.accessibleMarkers) {
        document.body.classList.add('accessible-markers')
        gameOptionsEl.querySelector('#accessible-markers').setAttribute('checked', 'checked')
    }
}

function setMessage(msg, type='error') {
    clearMessage()
    guessInfo.innerText = msg
    guessInfo.classList.add(type)
    guessInfo.classList.remove('hidden')
}

function clearMessage() {
    guessInfo.classList.add('hidden')
    guessInfo.innerText = ''
    guessInfo.classList.remove('error')
    guessInfo.classList.remove('info')
    guessInfo.classList.remove('success')
}

async function retrieveDictionary() {
    try {
        console.info('Retrieving dictionary...')
        const resp = await fetch('/dictionary')
        if (resp.status === 200) {
            const dict = await resp.json()
            localStorage.setItem('guessle-dictionary', JSON.stringify(dict))
            return dict
        }
        return null
    } catch(err) {
        return null
    }
}


//------------------ Some startup actions -------------------- //

;(async () => {
    // Ensure the server has the latest user options
    await sendServerOptions(options)

    console.info('Getting current game status...')
    const resp = await fetch('/status?generate=true')
    if (resp.status === 200) {
        const game = await resp.json()
        buildGuessInputs(game.wordLength)
        renderFutureGuesses(game.guesses.length, game.wordLength)

        const defaultOpener = options.openers[`${game.wordLength}`]
        if (game.guesses.length === 0 && defaultOpener && defaultOpener.length === game.wordLength) {
            console.log(`No guesses, using default ${game.wordLength}-letter opener:`, defaultOpener)
            await submitGuess(defaultOpener)
            document.querySelector('.used-default-opener').classList.remove('hidden')
        } else if (game.guesses.length > 0) {
            showLetterHints(game.guesses)
        }
    } else if (resp.status === 404) {
        console.info('No current game, redirecting user to force new game.')
        return window.location.replace('/')
    }

    try {
        dictionary = JSON.parse(localStorage.getItem('guessle-dictionary'))
        if (!Array.isArray(dictionary[5]) || !Array.isArray(dictionary[6])) {
            dictionary = await retrieveDictionary()
        }
    } catch(err) {
        if (err instanceof SyntaxError) {
            dictionary = await retrieveDictionary()
        }
    }
})()
