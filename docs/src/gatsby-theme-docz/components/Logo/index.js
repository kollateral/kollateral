import React from 'react'
import styled from 'styled-components'

// import { primary } from '../colors'

const StyledLogo = styled.span`
  font-family: Ubuntu;
  font-size: 24px;
  font-weight: 700;
  margin-left: 12px;
`
export const Logo = () => (
    <a
        href="https://kingmaker.dev"
        style={{
            color: 'inherit',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            textDecoration: 'none',
        }}
    >
        <img src="../../../../public/favicon.png" alt="Kingmaker" width="64" height="64fire" />
        <StyledLogo>Kingmaker</StyledLogo>
    </a>
)