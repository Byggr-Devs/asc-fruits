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
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { Brand } from './Brand'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

const navGroups: { title: string; items: NavItem[] }[] = [
  { title: '', items: [{ to: '/', label: 'Dashboard', icon: Home, end: true }] },
  {
    title: 'Operations',
    items: [
      { to: '/orders', label: 'Orders', icon: ClipboardList },
      { to: '/godown', label: 'Godown', icon: Truck },
      { to: '/stock', label: 'Stock', icon: Warehouse, end: true },
      { to: '/stock/movements', label: 'Movements', icon: History },
      { to: '/stock/report', label: 'Daily Report', icon: FileText },
    ],
  },
  {
    title: 'Masters',
    items: [
      { to: '/catalog', label: 'Fruits', icon: Apple },
      { to: '/vendors', label: 'Vendors', icon: Users },
    ],
  },
]

const bottomNav: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/godown', label: 'Godown', icon: Truck },
  { to: '/stock', label: 'Stock', icon: BarChart3 },
]

const moreNav: NavItem[] = [
  { to: '/catalog', label: 'Fruits & Varieties', icon: Apple },
  { to: '/vendors', label: 'Vendors', icon: Users },
  { to: '/stock/movements', label: 'Stock Movements', icon: History },
  { to: '/stock/report', label: 'Daily Report', icon: FileText },
]

export function AppShell() {
  const { session, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const email = session?.user.email ?? ''

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
            <div className="truncate px-3 pb-1 text-2xs text-muted" title={email}>
              {email}
            </div>
          )}
          <button
            onClick={signOut}
            title="Sign out"
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-button px-3 text-xs font-medium text-muted hover:bg-surface-low hover:text-ink"
          >
            <LogOut className="size-[18px] shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-button px-3 text-xs font-medium text-muted hover:bg-surface-low hover:text-ink"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px] shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="size-[18px] shrink-0" /> Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur md:hidden">
          <Brand />
          <button
            onClick={() => setMoreOpen(true)}
            className="flex size-11 cursor-pointer items-center justify-center rounded-button text-muted hover:bg-surface-low"
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
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
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/35" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-modal bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-modal">
            <div className="mb-2 flex items-center justify-between">
              <div className="truncate text-xs text-muted">{email}</div>
              <button
                onClick={() => setMoreOpen(false)}
                className="flex size-10 cursor-pointer items-center justify-center rounded-button text-muted"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
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
              <LogOut className="size-4" /> Sign out
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
