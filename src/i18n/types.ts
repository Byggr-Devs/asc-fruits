export type Locale = 'en' | 'ta'

export type MessageVars = Record<string, string | number>

export type TranslateFn = (key: string, vars?: MessageVars) => string
