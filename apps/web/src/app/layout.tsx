export const metadata = {
  title: 'Kuyari',
  description: 'Kuyari LLM assistant dashboard'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
