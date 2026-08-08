import type { PipelineErrorCode } from '../lib/cv/pipeline'

export function ErrorCard({ code, message, onRetry }: { code: PipelineErrorCode; message: string; onRetry: () => void }) {
  const detail =
    code === 'blurry'
      ? 'Hold the camera steady, tap to focus, and make sure there is even lighting.'
      : code === 'not-braille'
        ? 'Fill the frame with the Braille dots — zoom in if needed and keep the page flat.'
        : code === 'decode'
          ? 'That file could not be read as an image.'
          : code === 'too-few-dots'
            ? 'Not enough dots were found.'
            : 'The device is struggling. Give it a moment and try again.'

  return (
    <div className="error-card" role="alert">
      <div className="error-card__icon" aria-hidden="true">
        {code === 'blurry' ? '🔍' : code === 'not-braille' ? '📄' : '⚠️'}
      </div>
      <h3 className="error-card__title">{titleFor(code)}</h3>
      <p className="error-card__msg">{message}</p>
      <p className="error-card__tip">{detail}</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        Retake photo
      </button>
    </div>
  )
}

function titleFor(code: PipelineErrorCode): string {
  switch (code) {
    case 'blurry':
      return 'Photo too blurry'
    case 'not-braille':
      return "That doesn't look like Braille"
    case 'decode':
      return 'Unreadable image'
    case 'too-few-dots':
      return 'Too few dots'
    case 'timeout':
      return 'Processing timed out'
  }
}
