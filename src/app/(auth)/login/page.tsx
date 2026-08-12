import { LoginForm } from '@/components/ui/LoginForm'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const t = await getT()
  return (
    <main className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🫓</div>
          <h1 className="text-2xl font-bold text-amber-900">Gorditas Doña Félix</h1>
          <p className="text-amber-700 text-sm mt-1">{t.login.subtitle}</p>
        </div>
        <LoginForm />
        <div className="flex justify-center mt-6">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  )
}
