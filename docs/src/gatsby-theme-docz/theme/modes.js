import * as colors from './colors'
import prismDark from './prism/dark'
import prismLight from './prism/light'

export const light = {
  ...colors,
  primary: '#E235F5',
  text: colors.grayDark,
  muted: colors.gray,
  link: '#E235F5',
  background: colors.white,
  border: colors.grayLight,
  sidebar: {
    bg: colors.grayExtraLight,
    navGroup: colors.grayDark,
    navLink: colors.grayDark,
    navLinkActive: '#E235F5',
    tocLink: colors.gray,
    tocLinkActive: colors.grayExtraDark,
  },
  header: {
    bg: colors.white,
    text: colors.grayDark,
    border: colors.grayLight,
    button: {
      bg: colors.blue,
      color: colors.white,
    },
  },
  props: {
    bg: colors.grayUltraLight,
    text: colors.grayDark,
    highlight: colors.blue,
    defaultValue: colors.gray,
    descriptionText: colors.grayDark,
    descriptionBg: colors.white,
  },
  playground: {
    bg: colors.white,
    border: colors.grayLight,
  },
  blockquote: {
    bg: colors.grayExtraLight,
    border: colors.grayLight,
    color: colors.gray,
  },
  prism: {
    ...prismDark,
  },
}

export const dark = {
  ...colors,
  primary: '#E235F5',
  text: colors.grayExtraLight,
  muted: colors.gray,
  link: colors.skyBlue,
  background: colors.grayExtraDark,
  border: colors.grayDark,
  sidebar: {
    bg: colors.grayExtraDark,
    navGroup: colors.gray,
    navLink: colors.grayLight,
    navLinkActive: '#E235F5',
    tocLink: colors.gray,
    tocLinkActive: colors.grayLight,
  },
  header: {
    bg: colors.dark,
    text: colors.grayLight,
    border: colors.grayDark,
    button: {
      bg: colors.skyBlue,
      color: colors.white,
    },
  },
  props: {
    bg: colors.dark,
    text: colors.gray,
    highlight: colors.skyBlue,
    defaultValue: colors.grayDark,
    descriptionText: colors.gray,
    descriptionBg: colors.grayExtraDark,
  },
  playground: {
    bg: colors.dark,
    border: colors.grayDark,
  },
  blockquote: {
    bg: colors.grayDark,
    border: colors.gray,
    color: colors.gray,
  },
  prism: {
    ...prismDark,
  },
}