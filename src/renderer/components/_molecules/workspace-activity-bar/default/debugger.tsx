import { DebuggerIcon } from '@root/renderer/assets'
import { ActivityBarButton } from '@root/renderer/components/_atoms/buttons'
import { ComponentPropsWithoutRef } from 'react'

type DebuggerButtonProps = ComponentPropsWithoutRef<typeof ActivityBarButton> & {
  debuggerVariant?: 'default' | 'muted' | 'green' | 'red'
}
export const DebuggerButton = ({ debuggerVariant = 'muted', ...props }: DebuggerButtonProps) => {
  return (
    <ActivityBarButton aria-label='Debugger' {...props}>
      <DebuggerIcon variant={debuggerVariant} />
    </ActivityBarButton>
  )
}
