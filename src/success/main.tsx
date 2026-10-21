import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SuccessApp from './SuccessApp';

createRoot(document.getElementById('root')!).render(<StrictMode><SuccessApp /></StrictMode>);
