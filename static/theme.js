(function() {
    const OPTIONS_KEY = 'guessle-options'
    const DEFAULT_COLORS = {
        present: '#eec4cc',
        correct: '#337f37'
    }
    const LEGACY_DEFAULT_COLORS = {
        present: '#cccc55',
        correct: '#99cc99'
    }

    function normalizeColor(value, fallback, legacyFallback) {
        if (!/^#[0-9a-f]{6}$/i.test(value || '')) { return fallback }
        return (value.toLowerCase() === legacyFallback) ? fallback : value
    }

    function normalizeColors(colors) {
        return {
            present: normalizeColor(colors && colors.present, DEFAULT_COLORS.present, LEGACY_DEFAULT_COLORS.present),
            correct: normalizeColor(colors && colors.correct, DEFAULT_COLORS.correct, LEGACY_DEFAULT_COLORS.correct)
        }
    }

    function apply(colors) {
        const normalized = normalizeColors(colors)
        const root = document.documentElement
        root.style.setProperty('--guessle-present-color', normalized.present)
        root.style.setProperty('--guessle-correct-color', normalized.correct)
        return normalized
    }

    function applyFromStorage() {
        try {
            const options = JSON.parse(localStorage.getItem(OPTIONS_KEY))
            return apply(options && options.colors)
        } catch(err) {
            return apply(DEFAULT_COLORS)
        }
    }

    window.guessleTheme = {
        DEFAULT_COLORS,
        apply,
        applyFromStorage
    }

    applyFromStorage()
})()
