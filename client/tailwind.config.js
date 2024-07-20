/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        light: "#eeeeff",
        mid: "#ccccff",
        dark: "#9191e6",
      },
    },
  },
  plugins: [],
};
