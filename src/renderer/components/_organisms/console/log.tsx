import { cn } from '@root/utils'
import { ComponentPropsWithoutRef } from 'react'

const messageClasses = {
  debug: 'text-neutral-500 dark:text-neutral-400',
  warning: 'text-yellow-600',
  error: 'text-red-500',
  info: 'text-brand-medium dark:text-brand',
  progress: 'text-brand-medium dark:text-brand',
}

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'progress'

type LogComponentProps = ComponentPropsWithoutRef<'p'> & {
  level?: LogLevel
  message: string
  tstamp: string
}

/**
 * A single console log.
 */
const LogComponent = ({ level, message, tstamp, ...rest }: LogComponentProps) => {
  let classForMessage = 'text-[#011432] dark:text-white pl-2'
  if (level && messageClasses[level]) {
    classForMessage = messageClasses[level]
  }
  return (
    <>
      {message &&
        (level === 'progress' ? (
          <div key='constant-progress-bar' className='my-2 h-4 w-full rounded-full bg-gray-200 dark:bg-gray-700'>
            <span
              className='flex h-4 items-center justify-center rounded-full bg-blue-600 text-center text-[10px] font-medium leading-none text-blue-100 transition-all duration-300'
              style={{ width: `${message}%` }}
            >
              {message}%
            </span>
          </div>
        ) : (
          <p className={cn('font-normal', classForMessage)} {...rest}>
            {level ? `[${tstamp}]: ${message}` : message}
          </p>
        ))}
    </>
  )
}

export { LogComponent }
