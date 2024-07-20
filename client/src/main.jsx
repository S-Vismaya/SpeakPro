import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';

ReactDOM.createRoot(document.getElementById('root')).render(
  <Auth0Provider
    domain="dev-l3swl5d3gwfqxc3c.us.auth0.com"
    clientId="t0ITlhfVtRYFhEYQ3sxg3d5tPiuIoGRg"
    authorizationParams={{
      redirect_uri: window.location.origin
    }}
  >
  <React.StrictMode>
    
      <App />
   
    
  </React.StrictMode>,
  </Auth0Provider>
)
