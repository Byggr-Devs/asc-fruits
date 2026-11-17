import {
  Apple,
  BarChart3,
  ClipboardList,
  FileText,
  History,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Truck,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { LanguageToggle, useT } from '../i18n/LanguageProvider'
import { Brand } from './Brand'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

export function AppShell() {
  const { session, signOut } = useAuth()
  const t = useT()
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const email = session?.user.email ?? ''

  const navGroups = useMemo(
    () => [
      { title: '', items: [{ to: '/', label: t('nav.dashboard'), icon: Home, end: true }] as NavItem[] },
      {
        title: t('nav.operations'),
        items: [
          { to: '/orders', label: t('nav.orders'), icon: ClipboardList },
          { to: '/godown', label: t('nav.godown'), icon: Truck },
          { to: '/stock', label: t('nav.stock'), icon: Warehouse, end: true },
          { to: '/stock/movements', label: t('nav.movements'), icon: History },
          { to: '/stock/report', label: t('nav.dailyReport'), icon: FileText },
        ] as NavItem[],
      },
      {
        title: t('nav.masters'),
        items: [
          { to: '/catalog', label: t('nav.fruits'), icon: Apple },
          { to: '/vendors', label: t('nav.vendors'), icon: Users },
        ] as NavItem[],
      },
    ],
    [t],
  )

  const bottomNav = useMemo(
    () =>
      [
        { to: '/', label: t('nav.home'), icon: Home, end: true },
        { to: '/orders', label: t('nav.orders'), icon: ClipboardList },
        { to: '/godown', label: t('nav.godown'), icon: Truck },
        { to: '/stock', label: t('nav.stock'), icon: BarChart3 },
      ] as NavItem[],
    [t],
  )

  const moreNav = useMemo(
    () =>
      [
        { to: '/catalog', label: t('nav.fruitsVarieties'), icon: Apple },
        { to: '/vendors', label: t('nav.vendors'), icon: Users },
        { to: '/stock/movements', label: t('nav.stockMovements'), icon: History },
        { to: '/stock/report', label: t('nav.dailyReport'), icon: FileText },
      ] as NavItem[],
    [t],
  )

  const moreActive = moreNav.some((n) => location.pathname.startsWith(n.to))

  return (
    <div
      className="min-h-screen md:flex"
      style={{ '--sidebar-w': collapsed ? '68px' : '250px' } as React.CSSProperties}
    >
      <aside
        className={`no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] md:flex ${collapsed ? 'w-[68px]' : 'w-[250px]'}`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Brand collapsed={collapsed} />
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.title || 'root'}>
              {group.title && !collapsed && (
                <div className="mb-1.5 px-3 text-3xs font-semibold tracking-wider text-muted uppercase">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SideLink key={item.to} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-border p-3">
          {!collapsed && (
            <>
              <div className="px-1 pb-2">
                <LanguageToggle className="w-full justify-center" />
              </div>
              <div className="truncate px-3 pb-1 text-2xs text-muted" title={email}>
                {email}
              </div>
            </>
          )}
          {collapsed && (
            <div className="flex justify-center pb-1">
              <LanguageToggle />
            </div>
          )}
          <button
            onClick={signOut}
            title={t('nav.signOut')}
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-button px-3 text-xs font-medium text-muted hover:bg-surface-low hover:text-ink"
          >
            <LogOut className="size-[18px] shrink-0" />
            {!collapsed && t('nav.signOut')}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-button px-3 text-xs font-medium text-muted hover:bg-surface-low hover:text-ink"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px] shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="size-[18px] shrink-0" /> {t('nav.collapse')}
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur md:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <button
              onClick={() => setMoreOpen(true)}
              className="flex size-11 cursor-pointer items-center justify-center rounded-button text-muted hover:bg-surface-low"
              aria-label={t('common.menu')}
            >
              <Menu className="size-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 pt-5 pb-28 sm:px-6 md:pt-6 md:pb-12">
          <Outlet />
        </main>
      </div>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {bottomNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 text-3xs font-semibold ${isActive ? 'text-primary' : 'text-muted'}`
            }
          >
            <item.icon className="size-[22px]" />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 text-3xs font-semibold ${moreActive ? 'text-primary' : 'text-muted'}`}
        >
          <MoreHorizontal className="size-[22px]" />
          {t('common.more')}
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/35" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-modal bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-modal">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="truncate text-xs text-muted">{email}</div>
              <div className="flex items-center gap-1">
                <LanguageToggle />
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex size-10 cursor-pointer items-center justify-center rounded-button text-muted"
                  aria-label={t('common.close')}
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-card border border-border bg-surface-low text-xs font-semibold"
                >
                  <item.icon className="size-6 text-primary" />
                  {item.label}
                </NavLink>
              ))}
            </div>
            <button
              onClick={signOut}
              className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-button border border-border text-sm font-semibold text-danger"
            >
              <LogOut className="size-4" /> {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex h-10 items-center gap-3 rounded-button px-3 text-xs font-medium transition ${
          isActive
            ? 'bg-primary-soft font-semibold text-primary-ink'
            : 'text-muted hover:bg-surface-low hover:text-ink'
        }`
      }
    >
      <item.icon className="size-[18px] shrink-0" />
      {!collapsed && item.label}
    </NavLink>
  )
}
