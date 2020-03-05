import React from 'react'
import styled from 'styled-components'

import { primary } from '../colors'

const StyledLogo = styled.span`
  font-family: Ubuntu;
  font-size: 24px;
  font-weight: 700;
  margin-left: 12px;
`
export const Logo = () => (
  <a
    href="https://kollateral.co"
    style={{
      color: 'inherit',
      display: 'flex',
      alignItems: 'center',
      textDecoration: 'none',
    }}
  >
    <svg
      fill={primary[400]}
      viewBox="0 0 212 212"
      height={32}
      width={32}
    >
      <rect x="0" y="0" width="70.667" height="212" />
      <rect x="0" y="70.667" width="141.333" height="70.667" />
      <rect x="141.333" y="141.333" width="70.667" height="70.667" />
      <rect x="141.333" y="0" width="70.667" height="70.667" />
    </svg>
    <StyledLogo>Kollateral</StyledLogo>
  </a>
)