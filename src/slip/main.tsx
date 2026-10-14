import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SlipApp from './SlipApp';

createRoot(document.getElementById('root')!).render(<StrictMode><SlipApp /></StrictMode>);
