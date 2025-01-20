// Import global styles and necessary components
// './globals.css' contains global CSS styles
// Inter is a font from Google Fonts
// Metadata is used for defining page metadata
// Toaster is used for displaying toast notifications
import './globals.css'
import { Inter } from 'next/font/google'
import { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

// Create an instance of the Inter font with latin subset
const inter = Inter({ subsets: ['latin'] })

// Define page metadata
export const metadata: Metadata = {
  title: 'Chat In a Box',
  description: 'Your personal chat assistant',
}

/**
 * Root layout component for the application.
 * Wraps the application with necessary providers and layout structure.
 * @param children - The child components to be rendered within the layout.
 * @returns The root layout component.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
