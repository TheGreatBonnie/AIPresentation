import "../styles/globals.css";
import "@copilotkit/react-ui/styles.css";
import "@copilotkit/react-textarea/styles.css";
import PrelineScript from "./components/PrelineScript";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-zinc-900">
      <body>{children}</body>
      <PrelineScript />
    </html>
  );
}
