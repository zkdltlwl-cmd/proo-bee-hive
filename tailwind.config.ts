import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Varela Round"', 'sans-serif'],
            },
            colors: {
                bee: {
                    yellow: '#FFD700', // 쨍한 꿀벌 노랑
                    black: '#000000',  // 만화 느낌을 위해 완전한 검정으로 변경
                    cream: '#FDFCF0',  // 스누피 만화지 같은 미색 배경
                    gray: '#E5E7EB',
                }
            },
            boxShadow: {
                // 더 묵직하고 명확한 만화적 그림자
                'comic': '4px 4px 0px 0px #000000',
                'comic-lg': '8px 8px 0px 0px #000000',
                'comic-hover': '2px 2px 0px 0px #000000',
            },
            borderWidth: {
                '3': '3px', // 중간 두께의 테두리 추가
            }
        },
    },
    plugins: [],
};
export default config;
