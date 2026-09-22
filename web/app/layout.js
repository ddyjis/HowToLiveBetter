import './globals.css';

export const metadata = {
  title: '高性價比人生指南 · 一次讀一條',
  description: '一條一條閱讀高性價比人生指南，了解成本、收益和證據來源。',
};

export default function RootLayout({ children }) {
  return <html lang="zh-HK"><body>{children}</body></html>;
}
