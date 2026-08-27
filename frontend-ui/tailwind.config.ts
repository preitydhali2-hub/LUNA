import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                nhs: {
                    blue: "#005EB8",
                    dark: "#003087",
                    cyan: "#41B6E6",
                },
            },
            animation: {
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'wave': 'wave 1.2s ease-in-out infinite',
                'breathe': 'breathe 6s ease-in-out infinite alternate',
            },
            keyframes: {
                wave: {
                    '0%, 100%': { transform: 'scaleY(0.2)' },
                    '50%': { transform: 'scaleY(1)' },
                },
                breathe: {
                    '0%': { transform: 'scale(1)', opacity: '0.6' },
                    '100%': { transform: 'scale(1.08)', opacity: '0.9' },
                }
            }
        },
    },
    plugins: [],
};
export default config;