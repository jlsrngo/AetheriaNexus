// Font loading for Aetheria Launch
import { loadFont } from '@remotion/google-fonts/Inter';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/Playfair+Display';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrains+Mono';

export const useFonts = () => {
  loadFont();
  loadPlayfair();
  loadJetBrains();
};

export const FONT_URLS = {
  inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  playfair: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap',
  jetbrains: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap',
};
