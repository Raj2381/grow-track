import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@student/components/Logo'
import { Button } from '@student/components/ui/button'
import { usePageTitle } from '@student/hooks/usePageTitle'

export default function NotFound({ message }: { message?: string }) {
  usePageTitle('Page not found')
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div>
        <Logo size={40} className="mb-8" />
        <div className="text-6xl font-bold tabular-nums text-brand-600">404</div>
        <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{message ?? "The page you're looking for doesn't exist or has moved."}</p>
        <Link to="/dashboard"><Button className="mt-6"><ArrowLeft className="h-4 w-4" />Back to dashboard</Button></Link>
      </div>
    </div>
  )
}
