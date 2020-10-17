import * as React from 'react'
import { Helmet } from 'react-helmet-async'

import './index.css'

// The doc prop contains some metadata about the page being rendered that you can use.
const Wrapper = ({ children }) => <React.Fragment>
    <Helmet>
        <meta charSet="utf-8" />
        <link rel="icon"
            type="image/png"
              href="https://docs.kingmaker.dev/public/favicon.png"
        />
        <link href="https://fonts.googleapis.com/css?family=Ubuntu&display=swap" rel="stylesheet"/>
    </Helmet>
    {children}
</React.Fragment>
export default Wrapper