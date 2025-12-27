import { IconStyles } from '@process:renderer/data/constants/icon-styles'
import { cn } from '@utils/cn'

import { IIconProps } from '../Types/iconTypes'

export const DownloadIcon = (props: IIconProps) => {
  const { className, size = 'sm', ...res } = props
  const sizeClasses = IconStyles.sizeClasses.small[size]
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={cn(`${sizeClasses}`, className)}
      {...res}
    >
      <title>Upload</title>
      <circle cx='12' cy='12' r='11.5' fill='#B4D0FE' opacity='0.4' />

      <g transform='translate(12, 12.5) scale(1.1) translate(-12, -12)'>
        <path
          fillRule='evenodd'
          clipRule='evenodd'
          d='M11.125 13.5338C11.0706 13.4929 11.0183 13.4476 10.9688 13.3981L9.11872 11.548C8.77701 11.2063 8.22299 11.2063 7.88128 11.548C7.53957 11.8897 7.53957 12.4437 7.88128 12.7855L9.73136 14.6355C10.9843 15.8885 13.0157 15.8885 14.2686 14.6355L16.1187 12.7855C16.4604 12.4437 16.4604 11.8897 16.1187 11.548C15.777 11.2063 15.223 11.2063 14.8813 11.548L13.0312 13.3981C12.9817 13.4476 12.9294 13.4929 12.875 13.5338V8.66673C12.875 8.18349 12.4832 7.79173 12 7.79173C11.5168 7.79173 11.125 8.18349 11.125 8.66673V13.5338Z'
          fill='#B4D0FE'
        />
      </g>
    </svg>
  )
}
