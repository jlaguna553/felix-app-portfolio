'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  value: string
  onChange: (url: string) => void
  bucket?: string
  folder?: string
  maxSizeMb?: number
  previewSize?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'w-16 h-16',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'images',
  folder = 'uploads',
  maxSizeMb = 5,
  previewSize = 'md',
  className,
}: Props) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen')
      return
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Máximo ${maxSizeMb} MB`)
      return
    }
    setUploading(true)
    setError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${folder}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (upErr) {
      setError('Error al subir la imagen')
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  return (
    <div className={className}>
      <div
        className={`relative ${SIZES[previewSize]} rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-brand-400 transition-colors`}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="w-full h-full object-contain"
              onError={e => (e.currentTarget.style.display = 'none')}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </>
        ) : uploading ? (
          <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-stone-300">
            <Upload className="w-5 h-5" />
            <span className="text-xs">Subir</span>
          </div>
        )}
      </div>

      {value && !uploading && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mt-1 flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          <X className="w-3 h-3" /> Quitar
        </button>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
