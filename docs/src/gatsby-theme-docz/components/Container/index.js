/** @jsx jsx */
import { jsx } from 'theme-ui'

import * as styles from './styles'

export const Container = props => {
  return (
    <div sx={styles.wrapper}>
      {props.children}
    </div>
  )
}