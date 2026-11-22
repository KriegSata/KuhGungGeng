import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import './readability.css';
import './guide-dialog.css';
import './shellfie.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
