export let hasOwnProperty = Object.prototype.hasOwnProperty
export let indexOf = Array.prototype.indexOf

let numberFormat: Intl.NumberFormat | undefined
let isSourceMap = /\.\w+\.map$/
let disabledPathPrefix = /^\(disabled\):/

export let isMac = navigator.platform.indexOf('Mac') >= 0

export let now = (): number => {
  return (window.performance || Date).now()
}

export let localStorageGetItem = (key: string): string | null => {
  try {
    // This throws in Safari sometimes, but it's ok to ignore that
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export let localStorageSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
  }
}

export let isSourceMapPath = (path: string): boolean => {
  return isSourceMap.test(path)
}

export let isDisabledPath = (path: string): boolean => {
  return disabledPathPrefix.test(path)
}

export let stripDisabledPathPrefix = (path: string): string => {
  return path.replace(disabledPathPrefix, '')
}

export let formatInteger = (value: number): string => {
  return numberFormat ? numberFormat.format(value) : value + ''
}

export let formatNumberWithDecimal = (value: number): string => {
  let parts = value.toFixed(1).split('.', 2)
  return formatInteger(+parts[0]) + '.' + parts[1]
}

export let bytesToText = (bytes: number): string => {
  if (bytes === 1) return '1 byte'
  if (bytes < 1024) return formatInteger(bytes) + ' bytes'
  if (bytes < 1024 * 1024) return formatNumberWithDecimal(bytes / 1024) + ' kb'
  if (bytes < 1024 * 1024 * 1024) return formatNumberWithDecimal(bytes / (1024 * 1024)) + ' mb'
  return formatNumberWithDecimal(bytes / (1024 * 1024 * 1024)) + ' gb'
}

export let textToHTML = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export let hueAngleToColor = (hueAngle: number): string => {
  let saturation = 0.6 + 0.4 * Math.max(0, Math.cos(hueAngle))
  let lightness = 0.5 + 0.2 * Math.max(0, Math.cos(hueAngle + Math.PI * 2 / 3))
  return 'hsl(' + hueAngle * 180 / Math.PI + 'deg, ' + Math.round(100 * saturation) + '%, ' + Math.round(100 * lightness) + '%)'
}

export let createText = (text: string) => {
  return document.createTextNode(text)
}

export let createCode = (text: string): HTMLElement => {
  let code = document.createElement('code')
  code.textContent = text
  return code
}

export let createSpanWithClass = (className: string, text: string): HTMLSpanElement => {
  let span = document.createElement('span')
  span.className = className
  span.textContent = text
  return span
}

export let commonPrefixFinder = (path: string, commonPrefix: string[] | undefined): string[] => {
  let parts = path.split('/')
  if (!commonPrefix) return parts

  // Note: This deliberately loops one past the end of the array so it can compare against "undefined"
  for (let i = 0; i <= parts.length; i++) {
    if (commonPrefix[i] !== parts[i]) {
      commonPrefix.length = i
      break
    }
  }

  return commonPrefix
}

export let commonPostfixFinder = (path: string, commonPostfix: string[] | undefined): string[] => {
  let parts = path.split('/')
  if (!commonPostfix) return parts.reverse()

  // Note: This deliberately loops one past the end of the array so it can compare against "undefined"
  for (let i = 0; i <= parts.length; i++) {
    if (commonPostfix[i] !== parts[parts.length - i - 1]) {
      commonPostfix.length = i
      break
    }
  }

  return commonPostfix
}

export let posixDirname = (path: string): string => {
  let slash = path.lastIndexOf('/')
  return slash < 0 ? '.' : path.slice(0, slash)
}

export let posixRelPath = (path: string, relToDir: string): string => {
  let pathParts = path.split('/')
  let dirParts = relToDir === '.' ? [] : relToDir.split('/')
  let i = 0
  while (i < dirParts.length && pathParts[0] === dirParts[i]) {
    pathParts.shift()
    i++
  }
  if (i === dirParts.length) pathParts.unshift('.')
  else while (i < dirParts.length) {
    pathParts.unshift('..')
    i++
  }
  return pathParts.join('/')
}

export let nodeModulesPackagePathOrNull = (path: string): string | null => {
  let parts = path.split('/')
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i] === 'node_modules') {
      parts = parts.slice(i + 1)
      if (parts.length > 1 && /^index\.(?:[jt]sx?)$/.test(parts[parts.length - 1])) parts.pop()
      return parts.join('/')
    }
  }
  return null
}

export let lastInteractionWasKeyboard = false

let darkMode = matchMedia("(prefers-color-scheme: dark)")
let darkModeDidChange = () => darkModeListener && darkModeListener()
export let wheelEventListener: ((e: WheelEvent) => void) | null = null
export let resizeEventListener: (() => void) | null = null
export let darkModeListener: (() => void) | null = null

export let setWheelEventListener = (listener: ((e: WheelEvent) => void) | null) => wheelEventListener = listener
export let setResizeEventListener = (listener: () => void) => resizeEventListener = listener
export let setDarkModeListener = (listener: () => void) => darkModeListener = listener

// Only do certain keyboard accessibility stuff if the user is interacting with the keyboard
document.addEventListener('keydown', () => lastInteractionWasKeyboard = true, { capture: true })
document.addEventListener('mousedown', () => lastInteractionWasKeyboard = false, { capture: true })

// Register event listeners as singletons so we don't need to worry about their lifetimes
window.addEventListener('wheel', e => wheelEventListener && wheelEventListener(e), { passive: false })
window.addEventListener('resize', () => resizeEventListener && resizeEventListener())
try {
  darkMode.addEventListener("change", darkModeDidChange)
} catch (o) {
  darkMode.addListener(darkModeDidChange)
}

// Handle the case where this API doesn't exist
try {
  numberFormat = new Intl.NumberFormat()
} catch {
}
