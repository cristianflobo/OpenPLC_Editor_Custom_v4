import { consoleSelectors } from '@root/renderer/hooks'
import { debounce } from 'lodash'
import { memo, useEffect, useMemo, useRef } from 'react'

import { LogComponent } from './log'

type LogEntry = {
  message: string
  id: string
  tstamp: Date
  level?: 'info' | 'warning' | 'error' | 'progress' | undefined
  finished?: boolean
}

const Console = memo(() => {
  const logs = consoleSelectors.useLogs()
  const bottomLogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const debouncedScrollToBottomLog = debounce(
      () => {
        if (bottomLogRef.current) {
          bottomLogRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
            inline: 'end',
          })
        }
      },
      75,
      { leading: false, trailing: true },
    )
    debouncedScrollToBottomLog()
    return () => {
      debouncedScrollToBottomLog.cancel()
    }
  }, [logs])

  const processedLogs = useMemo<LogEntry[]>(() => {
    return logs.reduce((acc: LogEntry[], log) => {
      if (log.level === 'progress') {
        const progressIndex = acc.findIndex((l) => l.level === 'progress' && !l.finished)
        if (progressIndex > -1) {
          acc[progressIndex] = { ...log, id: log.id + `-${log.message}` }
          if (log.message === '100') {
            acc[progressIndex] = { ...acc[progressIndex], finished: true }
          }
        } else {
          acc.push(log)
        }
      } else {
        acc.push(log)
      }
      return acc
    }, [])
  }, [logs])

  return (
    <div
      aria-label='Console'
      className='relative h-full w-full overflow-auto text-cp-base font-semibold text-brand-dark focus:outline-none dark:text-neutral-50'
    >
      {processedLogs.length > 0 &&
        processedLogs.map((log) => (
          <LogComponent key={log.id} level={log.level} message={log.message} tstamp={log.tstamp.toLocaleTimeString()} />
        ))}
      <div ref={bottomLogRef} id='bottom-log' className='h-2' />
    </div>
  )
})
export { Console }
