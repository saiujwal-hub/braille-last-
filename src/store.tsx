import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BrailleLang } from './domain/tables'
import type { ScanFail, ScanOk } from './lib/cv/pipeline'
import { addHistory, deleteHistory, historyAvailable, listHistory, type HistoryEntry } from './lib/db'
import { imageDataToDataUrl } from './lib/imageInput'
import { scanImage } from './lib/scanClient'

interface AppContextValue {
  language: BrailleLang
  setLanguage: (l: BrailleLang) => void
  lastResult: ScanOk | null
  setLastResult: (r: ScanOk | null) => void
  history: HistoryEntry[]
  refreshHistory: () => Promise<void>
  saveScan: () => Promise<boolean>
  deleteScan: (id: string) => Promise<void>
  dbOk: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<BrailleLang>('en')
  const [lastResult, setLastResult] = useState<ScanOk | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const dbOk = historyAvailable()

  const refreshHistory = useCallback(async () => {
    if (!historyAvailable()) {
      setHistory([])
      return
    }
    try {
      setHistory(await listHistory())
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  const setLanguage = useCallback((l: BrailleLang) => setLanguageState(l), [])

  const saveScan = useCallback(async (): Promise<boolean> => {
    if (!lastResult || !historyAvailable()) return false
    const thumb = imageDataToDataUrl(lastResult.display, lastResult.displayWidth, lastResult.displayHeight, 0.7)
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      text: lastResult.text.slice(0, 200),
      overall: lastResult.overall,
      language: lastResult.language,
      cellCount: lastResult.cells.length,
      uncertainCount: lastResult.cells.filter((c) => c.status === 'uncertain').length,
      thumb: thumb || null,
    }
    try {
      await addHistory(entry)
      await refreshHistory()
      return true
    } catch {
      return false
    }
  }, [lastResult, refreshHistory])

  const deleteScan = useCallback(
    async (id: string) => {
      if (!historyAvailable()) return
      await deleteHistory(id)
      await refreshHistory()
    },
    [refreshHistory],
  )

  const value = useMemo(
    () => ({ language, setLanguage, lastResult, setLastResult, history, refreshHistory, saveScan, deleteScan, dbOk }),
    [language, setLanguage, lastResult, history, refreshHistory, saveScan, deleteScan, dbOk],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Scan state machine (lives inside the router so it can navigate).
// ---------------------------------------------------------------------------

export type ScanPhase = 'idle' | 'scanning' | 'error'

interface ScanContextValue {
  phase: ScanPhase
  scanError: ScanFail | null
  startScan: (rgba: Uint8ClampedArray, width: number, height: number, lang?: BrailleLang) => Promise<void>
  clearScanError: () => void
}

const ScanContext = createContext<ScanContextValue | null>(null)

export function ScanProvider({
  children,
  navigate,
}: {
  children: ReactNode
  navigate: (to: string, opts?: { replace?: boolean }) => void
}) {
  const { language, setLastResult } = useApp()
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [scanError, setScanError] = useState<ScanFail | null>(null)

  const startScan = useCallback(
    async (rgba: Uint8ClampedArray, width: number, height: number, lang?: BrailleLang) => {
      setPhase('scanning')
      setScanError(null)
      const out = await scanImage(rgba, width, height, lang ?? language)
      if (out.ok) {
        setLastResult(out)
        setPhase('idle')
        navigate('/result', { replace: true })
      } else {
        setScanError(out)
        setPhase('error')
        navigate('/scan', { replace: true })
      }
    },
    [language, navigate, setLastResult],
  )

  const clearScanError = useCallback(() => {
    setScanError(null)
    setPhase('idle')
  }, [])

  const value = useMemo(
    () => ({ phase, scanError, startScan, clearScanError }),
    [phase, scanError, startScan, clearScanError],
  )

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext)
  if (!ctx) throw new Error('useScan must be used within ScanProvider')
  return ctx
}
