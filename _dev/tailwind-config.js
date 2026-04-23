/**
 * Keeply Website — Shared Tailwind Configuration
 * 所有頁面引用此檔案，確保品牌色系和字型一致。
 * 用法：在 Tailwind CDN <script> 之後立即載入（同步，非 defer）
 */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['"M PLUS Rounded 1c"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
      }
    }
  }
};
