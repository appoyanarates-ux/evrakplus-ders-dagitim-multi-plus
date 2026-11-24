/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./renderer/**/*.html", "./renderer/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Segoe UI'", "-apple-system", "BlinkMacSystemFont", "Roboto", "sans-serif"]
      }
    }
  },
  plugins: []
};
