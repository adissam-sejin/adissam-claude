import { useEffect, useState } from 'react'
import { useApp } from '../ctx'
import { makePhoto } from '../lib/photo'
import type { Building } from '../lib/types'
import { Loading, Sheet } from './ui'

// 인증사진: 4:5 그림으로 만들어 저장하거나 바로 나눈다.
export function PhotoSheet({ b, floorId, onClose }: { b: Building; floorId?: string; onClose: () => void }) {
  const { toast } = useApp()
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let url = ''
    makePhoto(b, floorId)
      .then((blob) => {
        url = URL.createObjectURL(blob)
        setPhoto({ blob, url })
      })
      .catch(() => setFailed(true))
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [b, floorId])

  const save = async () => {
    if (!photo) return
    const fileName = `brandtown-${new Date().toISOString().slice(0, 10)}.jpg`
    const file = new File([photo.blob], fileName, { type: 'image/jpeg' })
    // 휴대폰에서는 "사진에 저장·카카오톡·인스타그램"을 고르는 창이 뜬다.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const a = document.createElement('a')
    a.href = photo.url
    a.download = fileName
    a.click()
    toast('사진을 내려받았어요.')
  }

  return (
    <Sheet title="인증사진" onClose={onClose}>
      {failed && <p className="empty">사진을 만들지 못했어요. 잠시 뒤에 다시 눌러 주세요.</p>}
      {!photo && !failed && <Loading text="사진을 찍는 중이에요" />}
      {photo && (
        <>
          <img className="photo-preview" src={photo.url} alt="내 건물 인증사진" />
          <button className="btn primary big" onClick={save}>사진 저장하기</button>
          <p className="muted small center">버튼이 듣지 않으면 사진을 길게 눌러 저장해 주세요.</p>
        </>
      )}
    </Sheet>
  )
}
