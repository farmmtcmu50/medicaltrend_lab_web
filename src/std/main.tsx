import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import StdApp from './StdApp';
import './std.css';

createRoot(document.getElementById('root')!).render(<StrictMode><StdApp /></StrictMode>);
