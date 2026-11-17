import { createClient } from '@supabase/supabase-js'
import type { TranslateFn } from '../i18n/types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const IMAGE_BUCKET = 'catalog-images'

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadImage(file: File, folder: 'fruits' | 'varieties'): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
  })
  if (error) throw error
  return path
}

const enFallback = {
  'common.somethingWrong': 'Something went wrong',
  'common.inUse': 'This item is in use by other records. Mark it inactive instead.',
  'common.duplicateName': 'An item with this name already exists.',
} as const

export function errorMessage(err: unknown, t?: TranslateFn): string {
  const tr = (key: keyof typeof enFallback) => (t ? t(key) : enFallback[key])
  if (!err) return tr('common.somethingWrong')
  if (typeof err === 'string') return err
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    const code = 'code' in err ? err.code : undefined
    if (code === '23503') return tr('common.inUse')
    if (code === '23505') return tr('common.duplicateName')
    return err.message
  }
  return tr('common.somethingWrong')
}
