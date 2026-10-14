import gsap from 'gsap';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App/>);

// Slow test browsers make GSAP stretch its animations out. ?exact keeps them on the clock, so a screenshot shows the framing a player would see.
if (new URLSearchParams(location.search).has('exact')) gsap.ticker.lagSmoothing(0);
