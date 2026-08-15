/**
 * Builds dist/keyhive-react.css.
 *
 * Every utility is prefixed `kh-` and every custom property `--kh-`, so the
 * output drops into an application that has no Tailwind and sits beside one
 * that does. Preflight is off, because a component library has no business
 * resetting its host's elements.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  prefix: "kh-",
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--kh-border))",
        input: "hsl(var(--kh-input))",
        ring: "hsl(var(--kh-ring))",
        background: "hsl(var(--kh-background))",
        foreground: "hsl(var(--kh-foreground))",
        primary: {
          DEFAULT: "hsl(var(--kh-primary))",
          foreground: "hsl(var(--kh-primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--kh-secondary))",
          foreground: "hsl(var(--kh-secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--kh-destructive))",
          foreground: "hsl(var(--kh-destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--kh-muted))",
          foreground: "hsl(var(--kh-muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--kh-accent))",
          foreground: "hsl(var(--kh-accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--kh-card))",
          foreground: "hsl(var(--kh-card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--kh-radius)",
        md: "calc(var(--kh-radius) - 2px)",
        sm: "calc(var(--kh-radius) - 4px)",
      },
    },
  },
  plugins: [],
};
