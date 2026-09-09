/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: { colors: { brand: { ink: "#231c2b", muted: "#655970", dark: "#68378d", surface: "#f0eafa" } } },
  },
  plugins: [],
};
