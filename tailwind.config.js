/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Archivo", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        line: "rgba(255, 255, 255, 0.12)",
        "line-strong": "rgba(255, 255, 255, 0.28)",
      },
    },
  },
  plugins: [],
}

