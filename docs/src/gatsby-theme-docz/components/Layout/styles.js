import { media } from '~theme/breakpoints'

export const main = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
}

export const wrapper = {
  py: 0,
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'max(calc(300px + (100vw - 1280px) / 2), 300px) 1fr',
  minHeight: '100vh',
  [media.tablet]: {
    display: 'block',
  },
}