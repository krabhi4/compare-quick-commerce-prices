import React from 'react'
import { ShieldCheck, LogIn, LogOut, Loader2, CheckCircle2, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { PLATFORM_INFO } from '../utils/normalize'

const PLATFORMS = ['blinkit', 'zepto', 'instamart', 'flipkart', 'bigbasket']

export const LoginPanel: React.FC = () => {
  const { identities, loading, loggingInPlatform, error, login, logout } = useAuth()

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Platform Accounts & Interactive Login
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Login to your quick-commerce accounts to view personalized pricing, VIP delivery slots, and member-only discounts. Your credentials never leave your browser session.
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Local session cookies stored securely in Docker volume data.</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map((plat) => {
          const meta = PLATFORM_INFO[plat]
          const account = identities[plat]
          const isLoggingIn = loggingInPlatform === plat
          const isLoggedIn = Boolean(account)

          return (
            <div
              key={plat}
              className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-100 text-base">{meta.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isLoggedIn ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-semibold">
                          {account === 'Active Session' ? 'Logged In' : account}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">Not connected</span>
                    )}
                  </div>
                </div>

                <div className={`w-3 h-3 rounded-full ${isLoggedIn ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-end gap-2">
                {isLoggedIn ? (
                  <button
                    type="button"
                    disabled={loading || isLoggingIn}
                    onClick={() => logout(plat)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-xs font-semibold text-slate-300 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loading || isLoggingIn}
                    onClick={() => login(plat)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
